import { ExplorerResolved } from '../explorerScope';
import type { ExplorerLocation, ExplorerScope } from '../../models/Explorer.types.ts';
import type { HarnessIndex, HarnessRevisionSummary } from '../../models/Harness.types.ts';

const short = (commit: string) => commit.slice(0, 7);

const missing = (message: string): ExplorerResolved => ({ kind: 'missing', message });

/** The head the index records for a branch, or what is wrong with the branch. */
function tipOf(index: HarnessIndex, branch: string): string | ExplorerResolved {
	const found = index.branches.find((item) => item.name === branch);
	if (!found) return missing(`Branch ${branch} is not in this history.`);
	const held = index.revisions.some((item) => item.commit === found.head);
	if (held) return found.head;
	return missing(`The tip of branch ${branch} (${short(found.head)}) is not in this history.`);
}

/**
 * Where an address is in a history. A branch address shows the head the index records for the
 * branch; an address with a commit shows that commit and keeps the tip beside it. The parent is
 * the first parent of the shown commit. A branch, a commit or a pairing of the two that the
 * history does not hold is reported, and no other revision is shown for it.
 */
export function explorerScope(index: HarnessIndex, location: ExplorerLocation): ExplorerResolved {
	const tip = location.branch === null ? null : tipOf(index, location.branch);
	if (tip !== null && typeof tip !== 'string') return tip;
	const commit = location.commit ?? tip ?? '';
	const summary = index.revisions.find((item) => item.commit === commit);
	if (!summary) return missing(`Commit ${short(commit)} is not in this history.`);
	if (location.branch !== null && !summary.branches.includes(location.branch)) {
		return missing(`Branch ${location.branch} does not contain commit ${short(commit)}.`);
	}
	return { kind: 'scope', scope: bound(location, tip, summary) };
}

/** The scope of an address whose branch and commit the history holds together. */
function bound(
	location: ExplorerLocation,
	tip: string | null,
	summary: HarnessRevisionSummary
): ExplorerScope {
	return {
		location,
		mode: location.commit === null ? 'current' : 'commit',
		branch: location.branch,
		tip,
		commit: summary.commit,
		atTip: summary.commit === tip,
		parent: summary.parents[0] ?? null,
		summary
	};
}
