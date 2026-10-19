import type { BenchMeasurement } from '../core/benchmarkTypes';
import type { RuntimeKind } from '../core/unitTypes';
import type { KernelBuild } from './kernelArtifacts';

export interface MeasureContext {
	profile: string;
	commit: string | null;
}

type Artifact = BenchMeasurement['artifacts'][number];
type Value = number | { unavailable: string };

export const kernelUnits: Record<RuntimeKind, string> = {
	module: 'function.impact-kernel',
	http: 'function.impact-kernel',
	wasm: 'kernel.impact-kernel',
	process: 'kernel.impact-kernel'
};

interface Entry {
	target: RuntimeKind;
	metric: string;
	unitOfMeasure: string;
	value: Value;
	method: string;
	workload?: string;
	samples?: number;
	artifacts?: Artifact[];
}

/** One benchmark measurement: a number, or an explicit reason there is none. */
export function benchMeasurement(context: MeasureContext, entry: Entry): BenchMeasurement {
	const measured = typeof entry.value === 'number';
	return {
		unit: kernelUnits[entry.target],
		metric: entry.metric,
		unitOfMeasure: entry.unitOfMeasure,
		value: measured ? (entry.value as number) : null,
		...(measured ? {} : { unavailable: (entry.value as { unavailable: string }).unavailable }),
		method: entry.method,
		workload: entry.workload ?? null,
		profile: context.profile,
		target: entry.target,
		...(entry.samples ? { samples: entry.samples } : {}),
		testedRevision: context.commit,
		artifacts: entry.artifacts ?? []
	};
}

const separate = 'The reference ships inside the CLI bundle and has no separate artifact.';
const transport = 'HTTP is a transport in front of a served unit; it emits no artifact.';

/** Emitted artifact sizes and owned source sizes, straight from the kernel build record. */
export function sizeMeasurements(context: MeasureContext, build: KernelBuild): BenchMeasurement[] {
	const size = (target: RuntimeKind, metric: string, value: Value, artifacts: Artifact[] = []) =>
		benchMeasurement(context, {
			target,
			metric,
			unitOfMeasure: 'bytes',
			value,
			method: 'Byte size recorded by the kernel build.',
			artifacts
		});
	const file = (path: string, item: { bytes: number; sha256: string }) => [{ path, ...item }];
	return [
		size('module', 'artifact-bytes', { unavailable: separate }),
		size('http', 'artifact-bytes', { unavailable: transport }),
		size('wasm', 'artifact-bytes', build.wasm.bytes, file('impact-kernel.wasm', build.wasm)),
		size('process', 'artifact-bytes', build.native.bytes, file('impact-kernel', build.native)),
		size('module', 'source-bytes', build.sources.reference.bytes, build.sources.reference.files),
		size('wasm', 'source-bytes', build.sources.crate.bytes, build.sources.crate.files),
		size('process', 'source-bytes', build.sources.crate.bytes, build.sources.crate.files)
	];
}
