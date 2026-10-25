import type { ExplorerLocation, ExplorerScope } from '../../../src/models/Explorer.types';
import type { HarnessIndex, HarnessRevisionSummary } from '../../../src/models/Harness.types';
import { explorerRoutePath } from '../../../../../src/utils/explorerRoute';

/**
 * A made-up history for the shell alone: two branches that share three commits, one branch whose
 * name holds a slash and a hash, and one commit no branch reaches. Nothing here is read from a
 * repository, and no hash, subject or status of it is a statement about one.
 */
export const sha = (number: number): string => number.toString(16).padStart(2, '0').repeat(20);
export const shellBranch = 'feature/shell#1';
export const longBranch = 'feature/compact-revision-controls-long-branch-name';
export const shellMount = '/harness';

function revision(
	number: number,
	subject: string,
	coverage: HarnessRevisionSummary['coverage'],
	branches: string[] = [shellBranch, 'main']
): HarnessRevisionSummary {
	return {
		commit: sha(number),
		parents: number > 1 ? [sha(number - 1)] : [],
		subject,
		author: 'Synthetic Author',
		committedAt: `2026-01-0${number}T10:00:00.000Z`,
		branches,
		retained: branches.length === 0,
		coverage,
		gaps: [],
		records: [],
		legacy: []
	};
}

export const shellIndex: HarnessIndex = {
	branches: [
		{ name: shellBranch, head: sha(5) },
		{ name: longBranch, head: sha(5) },
		{ name: 'main', head: sha(3) }
	],
	revisions: [
		revision(5, 'Add the unified navbar', 'unverified', [shellBranch, longBranch]),
		revision(4, 'Sketch the explorer shell', 'failed', [shellBranch]),
		revision(3, 'Record page evidence', 'verified'),
		revision(2, 'Add the title service', 'verified'),
		revision(1, 'Start the project', 'verified'),
		{ ...revision(9, 'Try a discarded idea', 'unverified', []), parents: [sha(2)] }
	],
	units: [],
	benchmarks: [],
	profiles: [],
	legacy: [],
	truncated: false,
	problems: []
};

/** The commits a branch lists, newest first, as a host hands them to the bar. */
export const shellCommits = (branch: string | null): HarnessRevisionSummary[] =>
	shellIndex.revisions.filter((item) =>
		branch === null ? item.retained : item.branches.includes(branch)
	);

/** An address resolved against the made-up history, as the host of the console resolves one. */
export function shellScope(location: ExplorerLocation): ExplorerScope {
	const tip = shellIndex.branches.find((item) => item.name === location.branch)?.head ?? null;
	const commit = location.commit ?? tip ?? '';
	const summary = shellIndex.revisions.find((item) => item.commit === commit);
	if (!summary) throw new Error(`the made-up history holds no commit ${commit}`);
	return {
		location,
		mode: location.commit === null ? 'current' : 'commit',
		branch: location.branch,
		tip,
		commit,
		atTip: commit === tip,
		parent: summary.parents[0] ?? null,
		summary
	};
}

/** The address of a location under the mount: the whole branch is one encoded segment. */
export function shellHref(to: ExplorerLocation): string {
	return `${shellMount}${explorerRoutePath(to)}`;
}

export const shellCategories = ['Pages', 'APIs', 'Code', 'Translations', 'Platforms'];
