import { refKind } from '../../../utils/git-source-history/historyRefs';

const deleted = /^0+$/;

/**
 * Reads the lines Git gives a pre-push hook and returns the commits that need a verification:
 * the new tips of source branches. Evidence, notes, archived source, tags and deletions are
 * history or bookkeeping, not code, and never start a verification.
 */
export function pushedRefs(input: string): string[] {
	const commits = input
		.split('\n')
		.map((line) => line.trim().split(/\s+/))
		.filter((parts) => parts.length === 4)
		.filter(([, local, remote]) => !deleted.test(local) && refKind(remote) === 'source')
		.map(([, local]) => local);
	return [...new Set(commits)];
}
