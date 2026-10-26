import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { sameTask } from '../../../helpers/agents-providers/moduleTaskApprovedSubmission';
import type { ApprovedTaskScope } from '../../../helpers/agents-providers/moduleTaskApprovedSubmission.types';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type {
	ModuleTask,
	ModuleTaskQueue,
	TaskSelection
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
export function pendingTaskResult(
	selection: TaskSelection,
	worktree: string
): NonNullable<ModuleTask['result']> {
	return {
		...selection,
		reportedModel: null,
		text: '',
		worktree,
		changedFiles: [],
		fallback: false,
		executions: [],
		finishedAt: new Date().toISOString()
	};
}
function dependencyCheckpoints(queue: ModuleTaskQueue, task: ModuleTask) {
	const checkpoints: string[] = [];
	for (const id of task.dependsOn ?? []) {
		const dependency = queue.tasks.find((candidate) => candidate.id === id);
		const checkpoint = dependency?.result?.checkpointCommit;
		if (
			dependency?.status !== 'accepted' ||
			dependency.feature.id !== task.feature.id ||
			!checkpoint ||
			!/^[a-f0-9]{40}$/.test(checkpoint)
		)
			return null;
		checkpoints.push(checkpoint);
	}
	return checkpoints;
}

/** Retain global contention and dependency records while admitting only verified queued tasks. */
export function approvedClaimQueue(queue: ModuleTaskQueue, scope: ApprovedTaskScope) {
	const { plan, feature, records } = scope;
	const latest = queue.plans?.filter((item) => item.feature === plan.feature).at(-1);
	const features = queue.features.filter((item) => item.id === feature.id);
	const ids = new Set(plan.tasks.map((task) => task.id));
	const validScope = [
		isDeepStrictEqual(latest, plan),
		plan.approval?.digest === plan.digest,
		feature.id === plan.feature,
		feature.goal === plan.goal,
		feature.tldr === plan.tldr,
		features.length === 1,
		isDeepStrictEqual(features[0], feature),
		ids.size === plan.tasks.length,
		records.length === ids.size,
		new Set(records.map((task) => task.id)).size === ids.size
	];
	if (!validScope.every(Boolean))
		throw new Error('Approved plan or task scope changed before claim.');
	for (const record of records) {
		const stored = queue.tasks.filter((task) => task.id === record.id);
		if (stored.length !== 1 || !ids.has(record.id))
			throw new Error('Approved task definition changed before claim.');
		if (!isDeepStrictEqual(record.feature, feature) || !sameTask(stored[0], record))
			throw new Error('Approved task definition changed before claim.');
	}
	return {
		...queue,
		tasks: queue.tasks.filter((task) => task.status !== 'queued' || ids.has(task.id))
	};
}
export function claimedTask(
	queue: ModuleTaskQueue,
	worker: string,
	modules: string[],
	...[owner, prepare = () => {}]: [
		NonNullable<ModuleTask['claim']>['owner'],
		((task: ModuleTask, checkpoints: string[]) => void)?
	]
) {
	const running = queue.tasks.filter((t) => t.status === 'running');
	const busy = new Set(running.map((t) => t.module.id));
	const busyFiles = new Set(running.flatMap((t) => t.module.files));
	const task = queue.tasks.find(
		(t) =>
			t.status === 'queued' &&
			(!t.assignee || t.assignee === worker) &&
			(!modules.length || modules.includes(t.module.id)) &&
			!busy.has(t.module.id) &&
			dependencyCheckpoints(queue, t) !== null &&
			!t.module.files.some((file) => busyFiles.has(file))
	);
	if (!task) return null;
	prepare(task, dependencyCheckpoints(queue, task)!);
	task.status = 'running';
	task.claim = { worker, token: randomUUID(), startedAt: new Date().toISOString(), owner };
	return task;
}
export function finishTask(
	queue: ModuleTaskQueue,
	claimed: ModuleTask,
	result: ModuleTask['result']
) {
	const current = queue.tasks.find((t) => t.id === claimed.id);
	if (
		!current ||
		![
			current.status === 'running',
			current.claim?.token === claimed.claim?.token,
			current.contractHash === claimed.contractHash,
			current.sourceCommit === claimed.sourceCommit,
			current.repairCommit === claimed.repairCommit
		].every(Boolean)
	)
		throw new Error('Task definition or claim changed; result was not overwritten.');
	current.status = result?.error ? 'failed' : 'review';
	current.result = result;
}
export async function taskWrites(git: GitAdapter, task: ModuleTask): Promise<string[]> {
	if ((await git.run(['rev-parse', 'HEAD'])) !== task.sourceCommit)
		throw new Error('Worker changed its source commit; review the preserved worktree.');
	const tracked = await git.run(['diff', '--name-only', '-z', 'HEAD']),
		untracked = await git.run(['ls-files', '--others', '--exclude-standard', '-z']);
	const paths = [...new Set((tracked + '\0' + untracked).split('\0').filter(Boolean))];
	const outside = paths.filter((path) => !task.module.files.includes(path));
	if (outside.length)
		throw new Error(
			`Worker wrote outside the assigned module: ${outside.join(', ')}. Worktree preserved.`
		);
	return paths;
}
