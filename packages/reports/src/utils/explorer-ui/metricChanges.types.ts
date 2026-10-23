import type { EntityMeasure } from './entityMeasure';

export interface MetricChangeRow {
	key: string;
	label: string;
	before: string;
	after: string;
	change: string;
	beforeContext?: string;
	afterContext?: string;
}

export interface MetricSide {
	commit: string;
	measure: EntityMeasure;
}

export interface MetricComparison {
	before: MetricSide;
	after: MetricSide;
}

export interface Sample {
	key: string;
	label: string;
	value: string;
	rawValue: number | null;
	unitOfMeasure: string | null;
	target?: string;
	workload?: string;
	profile?: string;
}
