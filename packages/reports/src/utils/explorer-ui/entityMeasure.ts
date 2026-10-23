export const notMeasured = 'Not measured';

/** The most a timing may worsen against its baseline under the recorded policy. */
export const tolerancePolicy = 0.05;

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

export { entityMeasure } from '../../components/explorer-ui/entity-sections/entityMeasure';

export type { MeasureRow, PerformanceRow, EntityMeasure } from './entityMeasure.types';
