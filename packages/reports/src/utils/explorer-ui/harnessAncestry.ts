import type { HarnessIndex } from '../../models/explorer-ui/Harness.types';

export const retainedBranch = 'Retained commits';

/**
 * Source branches that have a commit in the index, plus one entry for tested commits that no
 * branch reaches any more. A branch whose commits a shortened index left out is not offered.
 */
export function branchNames(index: HarnessIndex): string[] {
	const present = new Set(index.revisions.flatMap((revision) => revision.branches));
	const retained = index.revisions.some((revision) => revision.retained);
	const names = index.branches.map((branch) => branch.name).filter((name) => present.has(name));
	return [...names, ...(retained ? [retainedBranch] : [])];
}

/** The commit to show first: the one asked for when the index holds it, else a branch head. */
export function defaultCommit(index: HarnessIndex, asked: string): string {
	const known = new Set(index.revisions.map((revision) => revision.commit));
	if (known.has(asked)) return asked;
	const head = index.branches.map((branch) => branch.head).find((commit) => known.has(commit));
	return head ?? index.revisions[0]?.commit ?? '';
}

export function branchOf(index: HarnessIndex, commit: string): string {
	const revision = index.revisions.find((item) => item.commit === commit);
	if (revision?.retained) return retainedBranch;
	return revision?.branches[0] ?? branchNames(index)[0] ?? '';
}

export { harnessAncestry } from './explorer-history/harnessAncestry';
export { branchCommits } from '../../components/explorer-ui/harness-navbar/harnessAncestry';
export { revisionLabel } from '../../components/explorer-ui/harness-selectors/harnessAncestry';
