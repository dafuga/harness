import type { Growth, Point, Head, Line, FocusedRun } from './historySeries.types';
import type { BenchmarkSeries } from '../../../core/git-source-history/historyIndexTypes';
import type {
	Measurement,
	VerificationRecord
} from '../../../core/verification-evidence/verificationTypes';
import { frozenMetrics } from '../../../utils/verification-evidence/budgetFindings';
import type { BudgetReview } from '../../../utils/verification-evidence/budgetReviews';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import { emittedKey, emittedSizes } from '../../../utils/development-tooling/emittedSizes';

/** A figure of the unit itself: it names no workload and no machine, unlike a benchmark's. */
const own = (item: Measurement) => !item.workload && !item.profile;

/**
 * Size and complexity of every unit at each commit that measured it, oldest first, with the
 * size of what it emits for each execution target and the reviews that froze or changed its
 * limits. One point per commit: several records of a commit measured the same source. Only the
 * unit's own figures are taken; a size a benchmark reports about its run is not one of them.
 */
export function unitGrowth(
	records: Array<Pick<VerificationRecord, 'id' | 'measurements'>>,
	reviews: Map<string, BudgetReview[]> = new Map()
): Growth {
	const units = new Map<string, Map<string, Point>>();
	const placed = (item: Measurement, record: string, add: (point: Point) => Point) => {
		const points = units.get(item.unit) ?? new Map<string, Point>();
		const commit = item.testedRevision;
		points.set(commit, add(points.get(commit) ?? { commit, record }));
		units.set(item.unit, points);
	};
	for (const record of records) {
		const sized = record.measurements.filter(
			(item) => own(item) && (frozenMetrics as readonly string[]).includes(item.metric)
		);
		for (const item of sized) placed(item, record.id, (point) => measuredPoint(point, item));
		for (const item of emittedSizes(record.measurements)) {
			placed(item, record.id, (point) => emittedPoint(point, item));
		}
	}
	return [...units]
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.map(([id, points]) => {
			const reviewed = reviews.get(id);
			return { id, growth: [...points.values()], ...(reviewed ? { reviews: reviewed } : {}) };
		});
}

/** The emitted size of one target: its bytes, or under the name of its limit why there are none. */
function emittedPoint(point: Point, item: Measurement & { target: string }): Point {
	if (item.value === null) {
		const reason = item.unavailable ?? 'It was not measured.';
		return { ...point, notes: { ...point.notes, [emittedKey(item.target)]: reason } };
	}
	return { ...point, emitted: { ...point.emitted, [item.target]: item.value } };
}

/**
 * One metric of a point: its value when there is one, and a note when it could not be measured
 * or leaves something out. A metric without a value is absent, never zero.
 */
function measuredPoint(point: Point, item: Measurement): Point {
	const note = item.value === null ? item.unavailable : item.partial;
	const notes = note ? { notes: { ...point.notes, [item.metric]: note } } : {};
	return { ...point, ...(item.value === null ? {} : { [item.metric]: item.value }), ...notes };
}

/** What makes two timings one line: where and how they were taken, and of exactly what. */
function seriesKey(item: Measurement): string {
	const { profile, unitOfMeasure, method, comparison } = item;
	return canonicalJson({ profile, unitOfMeasure, method, comparison: comparison ?? null });
}

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
export function historySeries(
	records: Array<Pick<VerificationRecord, 'id' | 'measurements'>>,
	focused: FocusedRun[] = []
): BenchmarkSeries[] {
	const groups = new Map<string, { head: Head; lines: Map<string, Line> }>();
	for (const record of [...records, ...focusedMeasurements(focused)]) {
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

/** Focused observations keep their original tested revision and never establish a verdict. */
function focusedMeasurements(runs: FocusedRun[]) {
	const points = runs.filter((run) => !run.gap).flatMap((run) => [run.red, run.green]);
	const records = points.flatMap((point) =>
		point?.id
			? [
					{
						id: point.id,
						measurements: (point.measurements ?? []).filter(
							(item) => item.testedRevision === point.commit
						)
					}
				]
			: []
	);
	return [...new Map(records.map((record) => [record.id, record])).values()];
}
