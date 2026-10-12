import type {
	ExplorerHistoryDetail,
	ExplorerHistoryRow,
	ExplorerScope
} from '../models/Explorer.types';
import type {
	HarnessGrowthPoint,
	HarnessIndex,
	HarnessRevision,
	HarnessRevisionSummary
} from '../models/Harness.types';
import { explorerChange } from './explorerEntities';
import { explorerVerdict } from './explorerVerdict';
import { harnessAncestry } from './harnessAncestry';

type Measured = NonNullable<ExplorerHistoryRow['measured']>;
const marks = ['added', 'removed', 'direct'] as const;

function measuredAt(point: HarnessGrowthPoint | undefined): Measured | null {
	if (!point) return null;
	return {
		record: point.record,
		size: point['source-bytes'] ?? null,
		complexity: point.complexity ?? null,
		dependencies: point.dependencies ?? null,
		notes: point.notes ?? {}
	};
}

/** The difference of one metric, only when both commits measured it. */
const delta = (now: number | null, before: number | null | undefined) =>
	now === null || before === null || before === undefined ? null : now - before;

const unbuilt = 'This history was built before it recorded what each commit changed.';
const unread = 'The source of this commit could not be compared with its parent.';
type Told = Pick<ExplorerHistoryRow, 'standing' | 'change' | 'gap'>;

/**
 * What the history records that a commit did to a unit: it changed, added or removed it, it
 * left it alone, which is null, or the history does not say, which is a gap and never unchanged.
 */
function told(summary: HarnessRevisionSummary, unit: string): Told | null {
	const { changes } = summary;
	if (!changes) {
		return { standing: 'unknown', change: null, gap: changes === null ? unread : unbuilt };
	}
	const change = marks.find((mark) => changes[mark].includes(unit));
	return change ? { standing: 'changed', change, gap: null } : null;
}

/**
 * The commits that changed one entity: the shown commit and its ancestors, newest first, and
 * never a later commit. A commit is listed when the history records that it changed, added or
 * removed the entity itself, whether or not anything verified or measured it, so an edit that
 * keeps every measured value is listed and a verified commit that left the entity alone is not.
 * A commit whose changes the history does not record is listed as a gap. Each row is compared
 * with its own first parent; sizes are those a record measured, against the nearest measured
 * ancestor, and reviewed baselines and approved growth stay with the commit they were recorded at.
 */
export function explorerHistory(
	index: HarnessIndex,
	scope: ExplorerScope,
	unit: string
): ExplorerHistoryRow[] {
	const ancestry = harnessAncestry(index, scope.commit).add(scope.commit);
	const entry = index.units.find((item) => item.id === unit);
	const points = new Map((entry?.growth ?? []).map((point) => [point.commit, point]));
	let before: Measured | null = null;
	const oldestFirst = index.revisions.filter((item) => ancestry.has(item.commit)).reverse();
	const rows = oldestFirst.flatMap((item): ExplorerHistoryRow[] => {
		const measured = measuredAt(points.get(item.commit));
		const previous = before;
		before = measured ?? before;
		const said = told(item, unit);
		if (!said) return [];
		const row: ExplorerHistoryRow = {
			commit: item.commit,
			subject: item.subject,
			author: item.author,
			committedAt: item.committedAt,
			coverage: item.coverage,
			previous: item.parents[0] ?? null,
			...said,
			measured,
			sizeChange: measured ? delta(measured.size, previous?.size) : null,
			complexityChange: measured ? delta(measured.complexity, previous?.complexity) : null,
			reviews: (entry?.reviews ?? []).filter((review) => review.commit === item.commit)
		};
		return [row];
	});
	return rows.reverse();
}

/**
 * What one stored revision says about an entity: whether its commit changed it against its first
 * parent, the version of it there, the reasons recorded for the change and whether it is proven.
 * A revision without a registry or without a stored impact does not say whether it changed.
 */
export function historyDetail(detail: HarnessRevision, unit: string): ExplorerHistoryDetail {
	const found = detail.registry.units.find((item) => item.id === unit && item.status === 'active');
	return {
		known: detail.registry.available && Boolean(detail.sourceImpact),
		present: Boolean(found),
		change: explorerChange(detail, unit),
		version: found?.version ?? null,
		explanations: detail.explanations.filter((item) => item.unit === unit),
		verdict: found ? explorerVerdict(found, detail) : null
	};
}
