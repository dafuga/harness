import { createHash } from 'node:crypto';
import { types } from 'node:util';
import {
	PerformanceProfileService,
	type ObservationInput
} from '../../../services/development-tooling/PerformanceProfileService';

interface Boundary {
	unit: string;
	operation: string;
	asynchronous: boolean;
	callable?: string;
	inferredName?: string;
}

interface RuntimeProfiles {
	collectors: Map<string, PerformanceProfileService>;
	flushing: boolean;
	exitRegistered: boolean;
}
// Vitest resets module caches, but its teardown still holds the original flush function.
// Keep only collector state on this runtime's global, scoped to the actual source URL.
const key = Symbol.for(`harness.source-profiles:${import.meta.url}`);
const globals = globalThis as unknown as Record<symbol, RuntimeProfiles | undefined>;
const profiles = (globals[key] ??= {
	collectors: new Map(),
	flushing: false,
	exitRegistered: false
});

function currentProfiler(): PerformanceProfileService | undefined {
	const directory = process.env.HARNESS_RUNTIME_PROFILE_DIR;
	if (!directory || profiles.flushing) return undefined;
	let collector = profiles.collectors.get(directory);
	if (!collector) {
		collector = new PerformanceProfileService();
		profiles.collectors.set(directory, collector);
	}
	return collector;
}

/** A failed import never reaches its finishing statement and therefore emits no success sample. */
export function beginSourceScope(boundary: Boundary): () => void {
	return currentProfiler()?.beginScope(observationInput(boundary, 'initialization')) ?? (() => {});
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
			const profiler = currentProfiler();
			if (!profiler || unsupported || completed + pending >= sourceSampleLimit)
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
	if (profiles.flushing) return;
	const previous = [process.env.HARNESS_EVIDENCE_DIR, process.env.TAKE_SCREENSHOT];
	profiles.flushing = true;
	try {
		for (const [directory, collector] of profiles.collectors) {
			process.env.HARNESS_EVIDENCE_DIR = directory;
			process.env.TAKE_SCREENSHOT = '1';
			collector.flush();
		}
	} finally {
		for (const [index, name] of ['HARNESS_EVIDENCE_DIR', 'TAKE_SCREENSHOT'].entries()) {
			if (previous[index] === undefined) delete process.env[name];
			else process.env[name] = previous[index];
		}
		profiles.flushing = false;
	}
}

if (!profiles.exitRegistered) {
	process.once('exit', flushSourceProfiles);
	profiles.exitRegistered = true;
}
