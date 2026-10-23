import type { Asked, ScopeFacts } from './recordedScope.types';
import type { ExplorerScope } from '../../../../reports/src/models/Explorer.types';
import type { HarnessRevisionSummary } from '../../../../reports/src/models/Harness.types';
import { categoryOf } from './categoryOf';

const short = (commit: string) => commit.slice(0, 7);

/** Refuses a view of the tip once the tip is elsewhere: nothing is read for a stale view. */
export function recordedTip(query: Asked, tip: string): void {
	if (query.mode === 'current' && query.commit !== tip)
		throw new Error(
			`Commit ${short(query.commit)} is no longer the tip of branch ${query.branch}.`
		);
}

/**
 * Where an evidence read is in history. `current` is the tip of the branch and nothing else: a
 * commit that is no longer the tip is refused as stale. `commit` stays on the named commit,
 * also when that is the tip. The parent is the exact first parent Git states, or none. The
 * summary is of this one revision, on the one branch that was selected: no other branch is
 * listed, and nothing is said that Git or the records of the commit do not say. An entity that
 * is not registered at the commit under one of the listed categories is refused.
 */
export function recordedScope(query: Asked, facts: ScopeFacts): ExplorerScope {
	const { branch, commit, mode } = query;
	recordedTip(query, facts.tip);
	const category = facts.kind === undefined ? null : categoryOf(facts.kind);
	if (!category) throw new Error('This entity is not registered at this commit.');
	const { parents, subject, author, committedAt } = facts.revision;
	const { coverage, gaps, records } = facts.judged;
	const summary: HarnessRevisionSummary = {
		...{ commit, parents, subject, author, committedAt },
		...{ coverage, gaps, records },
		branches: [branch],
		retained: false,
		legacy: facts.legacy
	};
	return {
		location: {
			branch,
			commit: mode === 'commit' ? commit : null,
			category,
			entity: query.entityId
		},
		mode,
		branch,
		tip: facts.tip,
		commit,
		atTip: commit === facts.tip,
		parent: summary.parents[0] ?? null,
		summary
	};
}

export type { ScopeFacts } from './recordedScope.types';
