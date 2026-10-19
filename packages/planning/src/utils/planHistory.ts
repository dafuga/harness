import type { Git } from './planGit';
import { revision } from './planGit';
import { fail } from './planData';
import { planIdentity } from './planIdentity';
import type { CommitInfo, HistoryEvent, RevisionInfo } from '../models/PlanningView.types';
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
function event(path: string): HistoryEvent {
	if (path === 'plan.json') return { kind: 'plan-created' };
	const design = /^designs\/(v\d+)\/design.json$/.exec(path);
	if (design) return { kind: 'design-added', version: design[1] };
	const approval = /^designs\/approvals\/(.+)\.json$/.exec(path);
	if (approval) return { kind: 'design-approved', approvalId: approval[1] };
	const thread = /^threads\/(.+)\/(thread.json|messages.ndjson)$/.exec(path);
	if (thread)
		return {
			kind: thread[2] === 'thread.json' ? 'thread-opened' : 'message-appended',
			threadId: thread[1]
		};
	return { kind: 'other', path };
}
export async function planHistory(
	git: Git,
	input: { unitId: string; revision?: string; limit?: number }
) {
	const rev = await revisionInfo(git, input.revision);
	const path = await planIdentity(git, rev.commit, input.unitId);
	const history = await commits(git, rev.commit, input.limit ?? 100, path);
	const entries = await Promise.all(
		history.map(async (commit) => {
			const names = (
				await git.run([
					'diff-tree',
					'--root',
					'--no-commit-id',
					'--name-only',
					'-r',
					commit.commit,
					'--',
					path
				])
			)
				.toString()
				.trim()
				.split('\n')
				.filter(Boolean);
			return { ...commit, events: names.map((name) => event(name.slice(path.length + 1))) };
		})
	);
	return { unitId: input.unitId, revision: rev, entries };
}
