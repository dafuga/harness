import { GitAdapter } from '../adapters/GitAdapter';
import { refKind } from '../utils/historyRefs';
import { sourceBranches, type ListedRef } from '../utils/sourceBranches';

export interface SourceRevision {
	commit: string;
	tree: string;
	parents: string[];
	subject: string;
	author: string;
	authoredAt: string;
	committedAt: string;
	/** Source branches that reach the commit. */
	branches: string[];
	/** True when only an archive ref keeps the commit. */
	retained: boolean;
}

export interface SourceHistory {
	branches: Array<{ name: string; head: string }>;
	revisions: SourceRevision[];
	truncated: boolean;
}

const fields = ['%H', '%T', '%P', '%an', '%aI', '%cI', '%s'].join('%x1f');

/**
 * The history of source code: its branches and their commits, plus tested commits that only an
 * archive ref still keeps. Branches are the local ones and those the repository has from its
 * remotes, so a normal clone holds the history of every branch. Evidence, notes and internal
 * refs are never listed as branches.
 */
export class SourceHistoryRepository {
	private readonly git: GitAdapter;

	constructor(root: string) {
		this.git = new GitAdapter(root);
	}

	async read(limit: number): Promise<SourceHistory> {
		const refs = await this.refs();
		const remotes = (await this.git.attempt(['remote'])) ?? '';
		const branches = sourceBranches(refs, remotes.split('\n').filter(Boolean));
		const archived = refs.filter(({ ref }) => refKind(ref) === 'archive').map(({ ref }) => ref);
		const tips = [...branches.map((branch) => branch.head), ...archived];
		if (tips.length === 0) return { branches, revisions: [], truncated: false };
		const reach = await this.reach(branches);
		const log = await this.git.run([
			'log',
			'--date-order',
			`--max-count=${limit + 1}`,
			`--format=${fields}%x1e`,
			...tips
		]);
		const commits = log.split('\x1e').map((entry) => entry.trim().split('\x1f'));
		const revisions = commits
			.filter((entry) => entry.length === 7)
			.map((entry) => revision(entry, reach));
		return { branches, revisions: revisions.slice(0, limit), truncated: revisions.length > limit };
	}

	/** Every ref with its tip; a symbolic one, such as a remote's HEAD, says what it points to. */
	private async refs(): Promise<ListedRef[]> {
		const format = '--format=%(refname)%09%(objectname)%09%(symref)';
		const listed = await this.git.run(['for-each-ref', format]);
		return listed
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				const [ref, head, symbolic] = line.split('\t');
				return symbolic ? { ref, head, symbolic } : { ref, head };
			});
	}

	/** For every commit, the branches that contain it. */
	private async reach(branches: SourceHistory['branches']): Promise<Map<string, string[]>> {
		const reach = new Map<string, string[]>();
		for (const branch of branches) {
			const commits = await this.git.run(['rev-list', branch.head]);
			for (const commit of commits.split('\n').filter(Boolean)) {
				reach.set(commit, [...(reach.get(commit) ?? []), branch.name]);
			}
		}
		return reach;
	}
}

function revision(entry: string[], reach: Map<string, string[]>): SourceRevision {
	const [commit, tree, parents, author, authoredAt, committedAt, subject] = entry;
	const branches = reach.get(commit) ?? [];
	return {
		commit,
		tree,
		parents: parents.split(' ').filter(Boolean),
		subject,
		author,
		authoredAt,
		committedAt,
		branches,
		retained: branches.length === 0
	};
}
