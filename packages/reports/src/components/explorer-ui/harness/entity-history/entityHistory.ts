import type { HistoryTiming } from '../../../../utils/explorer-ui/entityHistory';
import type {
	ExplorerHistoryDetail,
	ExplorerHistoryRow
} from '../../../../models/explorer-ui/Explorer.types';
import type { HarnessIndex } from '../../../../models/explorer-ui/Harness.types';

type Coverage = ExplorerHistoryRow['coverage'];

const verdicts: Record<Coverage, { passed: boolean; label: string }> = {
	verified: { passed: true, label: 'Full coverage passed' },
	failed: { passed: false, label: 'Verification failed' },
	invalid: { passed: false, label: 'Evidence unusable' },
	unverified: { passed: false, label: 'Evidence missing' }
};

const own = ['direct', 'added', 'removed'];

/** What the evidence of a commit comes to: a check for a verified one, a cross for any other. */
export function historyVerdict(coverage: Coverage): { passed: boolean; label: string } {
	return verdicts[coverage];
}

/**
 * The rows a history lists: the commits that changed the entity. A commit the history records
 * as a change is listed. A commit the history cannot speak for is listed only once its revision
 * was read and says the commit changed the entity itself, so no change is assumed and none is
 * hidden. The second answer is the commits that are still not known.
 */
export function historyListed(
	rows: ExplorerHistoryRow[],
	read: Pick<Map<string, ExplorerHistoryDetail>, 'get'>
): { listed: ExplorerHistoryRow[]; unread: ExplorerHistoryRow[] } {
	const said = (row: ExplorerHistoryRow) => read.get(row.commit);
	const changed = (row: ExplorerHistoryRow) => own.includes(said(row)?.change ?? '');
	return {
		listed: rows.filter((row) => row.standing === 'changed' || changed(row)),
		unread: rows.filter((row) => row.standing === 'unknown' && !said(row))
	};
}

/**
 * The timings of one entity at each commit its history lists, by benchmark and by profile. A
 * value stands beside the value its own series has at the commit listed before it; a series that
 * has none there has no value before, and no other profile or commit supplies one. Only the
 * listed commits are read, so nothing later than the shown commit is.
 */
export function entityHistory(
	index: HarnessIndex,
	unit: string,
	rows: ExplorerHistoryRow[]
): Map<string, HistoryTiming[]> {
	const found = new Map<string, HistoryTiming[]>();
	const benchmarks = index.benchmarks.filter((item) => item.unit === unit);
	rows.forEach((row, position) => {
		const earlier = rows[position + 1]?.commit ?? null;
		const timings = benchmarks.flatMap(({ workload, metric, target, series }) =>
			series.flatMap((item) => {
				const at = (commit: string | null) =>
					item.points.findLast((point) => point.commit === commit)?.value;
				if (!['ms', 'us', 'μs', 'ns', 's'].includes(item.unitOfMeasure)) return [];
				const [after, before] = [at(row.commit), at(earlier)];
				if (after === undefined) return [];
				const shared = {
					profile: item.profile,
					workload,
					metric,
					target,
					unit: item.unitOfMeasure
				};
				return [{ ...shared, ...(before === undefined ? {} : { before }), after }];
			})
		);
		if (timings.length) found.set(row.commit, timings);
	});
	return found;
}

/** The profiles the timings of a history were taken under, in the order they first occur. */
export function historyProfiles(timings: Map<string, HistoryTiming[]>): string[] {
	return [...new Set([...timings.values()].flat().map((timing) => timing.profile))];
}
