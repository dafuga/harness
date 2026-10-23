import type { BenchMeasurement } from '../../core/development-tooling/benchmarkTypes';
import type { RuntimeKind } from '../../core/development-tooling/unitTypes';

export interface MeasureContext {
	profile: string;
	commit: string | null;
}

export type Artifact = BenchMeasurement['artifacts'][number];

export type Value = number | { unavailable: string };

export interface Entry {
	target: RuntimeKind;
	metric: string;
	unitOfMeasure: string;
	value: Value;
	method: string;
	workload?: string;
	samples?: number;
	artifacts?: Artifact[];
}
