import type { HarnessIndex, HarnessRevisionSummary } from '../models/Harness.types';

export const retainedBranch = 'Retained commits';

/** Commits that are ancestors of a commit, following recorded parents; the commit is excluded. */
export function harnessAncestry(index: HarnessIndex, commit: string): Set<string> {
	const parents = new Map(index.revisions.map((revision) => [revision.commit, revision.parents]));
	const seen = new Set<string>();
	const queue = [...(parents.get(commit) ?? [])];
	while (queue.length > 0) {
		const next = queue.pop() as string;
		if (seen.has(next)) continue;
		seen.add(next);
		queue.push(...(parents.get(next) ?? []));
	}
	return seen;
}

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

/** The commits a branch contains, newest first; evidence and notes are never among them. */
export function branchCommits(index: HarnessIndex, branch: string): HarnessRevisionSummary[] {
	return index.revisions.filter((revision) =>
		branch === retainedBranch ? revision.retained : revision.branches.includes(branch)
	);
}

export function branchOf(index: HarnessIndex, commit: string): string {
	const revision = index.revisions.find((item) => item.commit === commit);
	if (revision?.retained) return retainedBranch;
	return revision?.branches[0] ?? branchNames(index)[0] ?? '';
}

const coverage = {
	verified: 'verified',
	failed: 'failed',
	invalid: 'evidence unusable',
	unverified: 'no evidence'
};

/** How a commit reads in a selector: its short hash, its subject and what proves it. */
export function revisionLabel(item: HarnessRevisionSummary): string {
	return `${item.commit.slice(0, 7)} ${item.subject} · ${coverage[item.coverage]}`;
}
