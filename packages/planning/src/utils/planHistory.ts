import type { Git } from './planGit';
import { revision } from './planGit';
import { fail } from './planData';
import type { CommitInfo, RevisionInfo } from '../models/PlanningView.types';

export async function commits(
	git: Git,
	rev: string,
	limit = 50,
	path?: string
): Promise<CommitInfo[]> {
	if (!Number.isInteger(limit) || limit < 1 || limit > 500)
		fail('invalid-input', 'Invalid history limit');
	const args = ['log', `-${limit}`, '--format=%H%x00%P%x00%an%x00%cI%x00%s', rev];
	if (path) args.push('--', path);
	return (await git.run(args))
		.toString()
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const [commit, parents, author, committedAt, subject] = line.split('\0');
			return {
				commit,
				parents: parents.split(' ').filter(Boolean),
				author,
				committedAt: new Date(committedAt).toISOString(),
				subject
			};
		});
}

export async function revisionInfo(git: Git, requested?: string): Promise<RevisionInfo> {
	const commit = await revision(git, requested);
	const head = commit === (await revision(git));
	let branch: string | null = null;
	try {
		if (head) branch = (await git.run(['symbolic-ref', '--short', 'HEAD'])).toString().trim();
	} catch {
		/* Detached revisions remain readable. */
	}
	const info = (await commits(git, commit, 1))[0];
	return {
		requested: requested ?? null,
		commit,
		head,
		branch,
		committedAt: info.committedAt,
		subject: info.subject
	};
}

export { planHistory } from '../lib/planning/planning-service/planHistory';
