import type { EntityMeasure, MeasureRow, PerformanceRow } from './entityMeasure';
import { byteSize, notMeasured } from './entityMeasure';

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

interface Sample {
	key: string;
	label: string;
	value: string;
	rawValue: number | null;
	unitOfMeasure: string | null;
	target?: string;
	workload?: string;
	profile?: string;
}

function performanceSample(label: string, row?: PerformanceRow): Sample {
	return {
		key: `performance:${label}`,
		label,
		value: row?.value ?? notMeasured,
		rawValue: row?.rawValue ?? null,
		unitOfMeasure: row?.unitOfMeasure ?? null,
		target: row?.target,
		workload: row?.workload,
		profile: row?.profile
	};
}

function sizeSamples(rows: MeasureRow[]): Sample[] {
	return rows
		.filter((row) => row.target !== 'none')
		.map((row) => ({
			key: `size:${row.label}:${row.target ?? ''}`,
			label: row.label,
			value: row.value,
			rawValue: row.rawValue ?? null,
			unitOfMeasure: row.unitOfMeasure ?? null,
			target: row.target
		}));
}

function compactSamples(measure: EntityMeasure): Sample[] {
	const primary = measure.performance.find(
		(row) => /latency|navigation|^p\d|duration|time/i.test(row.metric) && row.value !== notMeasured
	);
	const memory = measure.performance.find(
		(row) =>
			/memory|heap|rss/i.test(row.metric) &&
			(!primary ||
				(row.workload === primary.workload &&
					row.target === primary.target &&
					row.profile === primary.profile))
	);
	return [
		...sizeSamples(measure.size),
		performanceSample('Latency', primary),
		performanceSample('Memory', memory)
	];
}

function context(row: Sample): string {
	return [row.workload, row.target, row.profile].filter(Boolean).join(' · ');
}

function compatibleChange(before?: Sample, after?: Sample): MetricChangeRow['change'] {
	if (!before || !after || before.rawValue === null || after.rawValue === null)
		return 'Not comparable';
	if (before.unitOfMeasure !== after.unitOfMeasure) return 'Unit changed';
	if (before.workload !== after.workload) return 'Workload changed';
	if (before.target !== after.target) return 'Target changed';
	if (before.profile !== after.profile) return 'Profile changed';
	const delta = after.rawValue - before.rawValue;
	return delta === 0 ? 'No change' : signedDelta(delta, before.unitOfMeasure);
}

function signedDelta(delta: number, unit: string | null): string {
	const sign = delta < 0 ? '−' : '+';
	const magnitude = Math.abs(delta);
	const value = unit === 'bytes' ? byteSize(magnitude) : String(Number(magnitude.toPrecision(4)));
	return `${sign}${value}${unit && unit !== 'bytes' ? ` ${unit}` : ''}`;
}

function contextsForChange(
	change: MetricChangeRow['change'],
	before?: Sample,
	after?: Sample
): Pick<MetricChangeRow, 'beforeContext' | 'afterContext'> {
	const changed = ['Profile changed', 'Target changed', 'Workload changed'].includes(change);
	return {
		...(changed && before ? { beforeContext: context(before) } : {}),
		...(changed && after ? { afterContext: context(after) } : {})
	};
}

function rowLabel(before?: Sample, after?: Sample): string {
	return after?.label ?? before?.label ?? '';
}

function rowValue(row?: Sample): string {
	return row?.value ?? notMeasured;
}

function changeRow(before?: Sample, after?: Sample): MetricChangeRow {
	const change = compatibleChange(before, after);
	return {
		key: after?.key ?? before?.key ?? '',
		label: rowLabel(before, after),
		before: rowValue(before),
		after: rowValue(after),
		change,
		...contextsForChange(change, before, after)
	};
}

/** Compact overview rows compare equal metrics and never turn missing evidence into a zero. */
export function metricChanges(before: EntityMeasure, after: EntityMeasure): MetricChangeRow[] {
	const older = new Map(compactSamples(before).map((row) => [row.key, row]));
	const newer = new Map(compactSamples(after).map((row) => [row.key, row]));
	const keys = [...new Set([...older.keys(), ...newer.keys()])];
	return keys.map((key) => changeRow(older.get(key), newer.get(key)));
}
