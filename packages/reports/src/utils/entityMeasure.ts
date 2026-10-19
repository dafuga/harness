

export const notMeasured = 'Not measured';

/** The most a timing may worsen against its baseline under the recorded policy. */
export const tolerancePolicy = 0.05;

export interface MeasureRow {
	label: string;
	value: string;
	/** Why there is no value, or what the value leaves out. */
	note?: string;
}

export interface PerformanceRow {
	workload: string;
	metric: string;
	/** The execution target the timing was taken on; empty when it names none. */
	target: string;
	/** The machine profile the timing was taken under; empty when nothing was measured. */
	profile: string;
	value: string;
	tolerance: string;
	/** True when the declared tolerance is looser than the policy allows. */
	over: boolean;
}

export interface EntityMeasure {
	size: MeasureRow[];
	performance: PerformanceRow[];
}

const scales: Array<[number, string]> = [
	[1_000_000, 'MB'],
	[1_000, 'KB']
];

/** A number of bytes as a person reads it; a small size keeps its bytes. */
export function byteSize(count: number): string {
	const size = Math.abs(count);
	const [scale, unit] = scales.find(([least]) => size >= least) ?? [1, 'B'];
	const scaled = count / scale;
	return `${Number.isInteger(scaled) ? scaled : Number(scaled.toFixed(1))} ${unit}`;
}

export { entityMeasure } from '../components/harness/entity-sections/entityMeasure';
