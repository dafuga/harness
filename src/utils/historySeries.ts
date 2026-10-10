import type { BenchmarkSeries, HistoryIndex } from '../core/historyIndexTypes';
import type { Measurement, VerificationRecord } from '../core/verificationTypes';
import { frozenMetrics } from './budgetFindings';
import { canonicalJson } from './canonicalJson';

type Growth = HistoryIndex['units'];
type Point = Growth[number]['growth'][number];

/**
 * Size and complexity of every unit at each commit that measured it, oldest first. One point
 * per commit: several records of a commit measured the same source.
 */
export function unitGrowth(records: VerificationRecord[]): Growth {
	const units = new Map<string, Map<string, Point>>();
	for (const record of records) {
		for (const item of record.measurements) {
			if (item.value === null || !(frozenMetrics as readonly string[]).includes(item.metric))
				continue;
			const points = units.get(item.unit) ?? new Map<string, Point>();
			const commit = item.testedRevision;
			const point = points.get(commit) ?? { commit, record: record.id };
			points.set(commit, { ...point, [item.metric]: item.value });
			units.set(item.unit, points);
		}
	}
	return [...units]
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.map(([id, points]) => ({ id, growth: [...points.values()] }));
}

/** What makes two timings one line: where and how they were taken, and of exactly what. */
function seriesKey(item: Measurement): string {
	const { profile, unitOfMeasure, method, comparison } = item;
	return canonicalJson({ profile, unitOfMeasure, method, comparison: comparison ?? null });
}

type Line = BenchmarkSeries['series'][number];
type Head = Pick<BenchmarkSeries, 'unit' | 'workload' | 'metric' | 'target'>;

/** A measurement that can be plotted: a value, taken on a workload, on a known profile. */
function timed(
	item: Measurement
): item is Measurement & { value: number; workload: string; profile: string } {
	return item.value !== null && Boolean(item.workload) && Boolean(item.profile);
}

/**
 * Timings grouped by unit, workload, metric and target. Within a group, values are one series
 * only when profile, unit of measure, method and comparison context are identical; anything
 * else is another series, and a group with more than one is marked incompatible.
 */
export function historySeries(records: VerificationRecord[]): BenchmarkSeries[] {
	const groups = new Map<string, { head: Head; lines: Map<string, Line> }>();
	for (const record of records) {
		for (const item of record.measurements.filter(timed)) {
			const { unit, workload, metric, profile, unitOfMeasure, method } = item;
			const head = { unit, workload, metric, target: item.target ?? null };
			const group = groups.get(canonicalJson(head)) ?? { head, lines: new Map<string, Line>() };
			const comparison = item.comparison ?? null;
			const line = group.lines.get(seriesKey(item)) ?? {
				profile,
				unitOfMeasure,
				method,
				comparison,
				points: []
			};
			line.points.push({ commit: item.testedRevision, record: record.id, value: item.value });
			group.lines.set(seriesKey(item), line);
			groups.set(canonicalJson(head), group);
		}
	}
	return [...groups.keys()].sort().flatMap((key) => {
		const group = groups.get(key);
		if (!group) return [];
		const series = [...group.lines.keys()].sort().flatMap((name) => group.lines.get(name) ?? []);
		return [{ ...group.head, incompatible: series.length > 1, series }];
	});
}
