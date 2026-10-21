import type { HarnessIndex } from '../../../models/explorer-ui/Harness.types';

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
