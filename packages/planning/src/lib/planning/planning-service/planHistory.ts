import { revisionInfo, commits } from '../../../utils/planHistory';
import type { Git } from '../../../utils/planGit';
import { planIdentity } from '../../../utils/planIdentity';
import type { HistoryEvent } from '../../../models/PlanningView.types';

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
