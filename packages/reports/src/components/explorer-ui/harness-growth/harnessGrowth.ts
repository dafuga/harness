import type { GrowthRow, GrowthMetric } from '../../../utils/explorer-ui/harnessGrowth';
import { growthMetrics } from '../../../utils/explorer-ui/harnessGrowth';
import type { HarnessBenchmark, HarnessIndex } from '../../../models/explorer-ui/Harness.types';

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
			notes: point.notes ?? {},
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
