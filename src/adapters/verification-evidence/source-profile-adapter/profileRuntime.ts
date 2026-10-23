import { createHash } from 'node:crypto';
import { types } from 'node:util';
import {
	PerformanceProfileService,
	type ObservationInput
} from '../../../services/verification-evidence/PerformanceProfileService';
import type { Boundary } from './profileRuntime.types';
export type { Boundary } from './profileRuntime.types';

const profiler = new PerformanceProfileService();
let flushing = false;

/** A failed import never reaches its finishing statement and therefore emits no success sample. */
export function beginSourceScope(boundary: Boundary): () => void {
	if (!process.env.HARNESS_RUNTIME_PROFILE_DIR || flushing) return () => {};
	return profiler.beginScope(observationInput(boundary, 'initialization'));
}

/** Metadata describes source boundaries only; values and arguments never enter the collector. */
export function watchOperation<T extends (...args: never[]) => unknown>(
	operation: T,
	boundary: Boundary
): T {
	if (!process.env.HARNESS_RUNTIME_PROFILE_DIR) return operation;
	const sourceSampleLimit = 10;
	if (boundary.inferredName && !operation.name)
		Object.defineProperty(operation, 'name', { value: boundary.inferredName, configurable: true });
	const input = observationInput(boundary, `first-${sourceSampleLimit}-successes`);
	let completed = 0,
		pending = 0,
		unsupported = false;
	return new Proxy(operation, {
		apply(target, receiver, args) {
			if (flushing || unsupported || completed + pending >= sourceSampleLimit)
				return Reflect.apply(target, receiver, args);
			const call = () => Reflect.apply(target, receiver, args);
			pending++;
			try {
				if (boundary.asynchronous)
					return profiler.observeAsync(input, call).then(
						(value) => {
							pending--;
							completed++;
							return value;
						},
						(error) => {
							pending--;
							throw error;
						}
					);
				const result = profiler.observe(input, call);
				pending--;
				if (types.isPromise(result)) unsupported = true;
				else completed++;
				return result;
			} catch (error) {
				pending--;
				throw error;
			}
		}
	});
}

/** Reading a data descriptor avoids evaluating accessors or replacing class instances. */
export function watchMethod(owner: object, name: string, boundary: Boundary): void {
	const descriptor = Object.getOwnPropertyDescriptor(owner, name);
	if (!descriptor || typeof descriptor.value !== 'function') return;
	Object.defineProperty(owner, name, {
		...descriptor,
		value: watchOperation(descriptor.value, boundary)
	});
}

function observationInput(boundary: Boundary, selection: string): ObservationInput {
	const context = createHash('sha256')
		.update(process.env.HARNESS_RUNTIME_PROFILE_CONTEXT ?? 'standard-runner')
		.digest('hex')
		.slice(0, 16);
	const operation = createHash('sha256').update(boundary.operation).digest('hex').slice(0, 16);
	return {
		unit: boundary.unit,
		workload: `source-${selection}-${process.versions.bun ? 'bun' : 'node'}-${process.versions.bun ?? process.versions.node}-${operation}-${context}`,
		...(boundary.callable ? { callable: boundary.callable } : {})
	};
}

/** The test runner owns a separate sink; verification-context isolation remains intact. */
export function flushSourceProfiles(): void {
	const directory = process.env.HARNESS_RUNTIME_PROFILE_DIR;
	if (!directory || flushing) return;
	const previous = [process.env.HARNESS_EVIDENCE_DIR, process.env.TAKE_SCREENSHOT];
	flushing = true;
	try {
		process.env.HARNESS_EVIDENCE_DIR = directory;
		process.env.TAKE_SCREENSHOT = '1';
		profiler.flush();
	} finally {
		for (const [index, name] of ['HARNESS_EVIDENCE_DIR', 'TAKE_SCREENSHOT'].entries()) {
			if (previous[index] === undefined) delete process.env[name];
			else process.env[name] = previous[index];
		}
		flushing = false;
	}
}

process.once('exit', flushSourceProfiles);
