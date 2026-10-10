import type { HarnessBenchmark, HarnessIndex } from '../models/Harness.types';

export const growthMetrics = ['source-bytes', 'complexity', 'dependencies'] as const;
export type GrowthMetric = (typeof growthMetrics)[number];

export interface GrowthRow {
	commit: string;
	subject: string;
	committedAt: string;
	values: Record<GrowthMetric, number | undefined>;
	/** Change since the previous measured point; undefined for the first point or no value. */
	deltas: Record<GrowthMetric, number | undefined>;
	changed: boolean;
}

/**
 * The measured size of one unit commit by commit, oldest first, with the change each commit
 * made. A metric nothing measured stays undefined and is shown as unavailable, never as zero.
 */
export function harnessGrowth(index: HarnessIndex, unit: string): GrowthRow[] {
	const order = new Map(index.revisions.map((revision, position) => [revision.commit, position]));
	const points = [...(index.units.find((item) => item.id === unit)?.growth ?? [])].sort(
		(left, right) => (order.get(right.commit) ?? 0) - (order.get(left.commit) ?? 0)
	);
	const rows: GrowthRow[] = [];
	for (const point of points) {
		const revision = index.revisions.find((item) => item.commit === point.commit);
		const previous = rows.at(-1)?.values;
		const pick = (source: (metric: GrowthMetric) => number | undefined) =>
			Object.fromEntries(growthMetrics.map((metric) => [metric, source(metric)])) as Record<
				GrowthMetric,
				number | undefined
			>;
		const values = pick((metric) => point[metric]);
		const deltas = pick((metric) => {
			const [now, before] = [point[metric], previous?.[metric]];
			return now === undefined || before === undefined ? undefined : now - before;
		});
		rows.push({
			commit: point.commit,
			subject: revision?.subject ?? '',
			committedAt: revision?.committedAt ?? '',
			values,
			deltas,
			changed: growthMetrics.some((metric) => Boolean(deltas[metric]))
		});
	}
	return rows;
}

/** Timings of one unit. Series taken under different conditions are never joined. */
export function unitTimings(index: HarnessIndex, unit: string): HarnessBenchmark[] {
	return index.benchmarks.filter((benchmark) => benchmark.unit === unit);
}

export function signed(delta: number | undefined): string {
	if (!delta) return '';
	return delta > 0 ? `+${delta}` : String(delta);
}
