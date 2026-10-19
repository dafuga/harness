import type { BenchMeasurement } from "../core/benchmarkTypes";
import type { RuntimeKind } from "../core/unitTypes";

export interface MeasureContext {
	profile: string;
	commit: string | null;
}

export type Artifact = BenchMeasurement['artifacts'][number];

export type Value = number | { unavailable: string };

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

export { sizeMeasurements } from '../workflows/run-kernel-bench/benchMeasurement';
