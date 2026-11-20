// @harness-uid u_b4uzqkb2i6
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { TaskWorktreeChangedError } from '../../adapters/agents-providers/ModuleTaskWorktreeAdapter.types';
import { ModuleTaskAnalyticsService } from './ModuleTaskAnalyticsService';
import { dispatchTaskAttempt } from './module-task-worker-service/dispatchTaskAttempt';
import { taskWorkspace, snapshotTaskWork } from './module-task-worker-service/taskWorkspace';
import type {
	ModuleTask,
	TaskRunner,
	TaskSelection,
	TaskExecution
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskRunInput } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { trackerHandoff } from '../../adapters/agents-providers/module-task-runner-adapter/trackerHandoff';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { ModuleTaskService } from './ModuleTaskService';
import { claimedTask, finishTask } from './module-task-worker-service/taskClaim';
/** Foreground workers claim atomically in a shared Git repository and preserve isolated review work. */
export class ModuleTaskWorkerService {
	private readonly repository: ModuleTaskRepository;
	constructor(
		private readonly root = process.cwd(),
		private readonly runner: TaskRunner = new ModuleTaskRunnerAdapter(),
		private readonly tracker?: string
	) {
		this.repository = new ModuleTaskRepository(root);
	}
	async once(worker: string, modules: string[] = [], signal = AbortSignal.timeout(900000)) {
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(worker))
			throw new Error('Worker must be a lowercase dotted or dashed identifier.');
		const owner = await this.repository.owner();
		const claim = await this.repository.update((queue) =>
			claimedTask(queue, worker, modules, owner)
		);
		if (!claim.value) return { status: 'idle' as const };
		return this.execute(claim.value, claim.commit!, signal);
	}
	private async execute(task: ModuleTask, commit: string, signal: AbortSignal) {
		const { selection, prompt } = new ModuleTaskService(this.root).prepare(task, commit);
		let result = await taskWorkspace(this.root, task, selection);
		const { sourceCommit, worktree } = result;
		try {
			await new GitAdapter(this.root).run(['worktree', 'add', '--detach', worktree, sourceCommit]);
			const execution = await this.run(
				task,
				{ ...selection, cwd: worktree, prompt, signal, onRotation: this.handoff(task, worktree) },
				(choice) => {
					result = { ...result, ...choice, fallback: true };
				},
				result.executions
			);
			result = { ...result, ...execution };
			await snapshotTaskWork(this.root, task, result);
		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Task worker failed.';
			if (result.executions.at(-1)?.status !== 'failed')
				result.failureCause =
					error instanceof TaskWorktreeChangedError ? 'scope' : 'workspace-error';
		}
		result.finishedAt = new Date().toISOString();
		await this.repository.update(
			(queue) => finishTask(queue, task, result),
			result.checkpointCommit
		);
		await new ModuleTaskAnalyticsService().sync(this.root);
		return {
			status: result.error ? ('failed' as const) : ('review' as const),
			task: task.id,
			result
		};
	}
	private handoff(task: ModuleTask, cwd: string): TaskRunInput['onRotation'] {
		const tracker = this.tracker;
		if (!tracker) return undefined;
		return (checkpoint, session) =>
			trackerHandoff(
				cwd,
				{
					tracker,
					checkpoint,
					role: 'module worker',
					evidence: `harness task show ${task.id}`
				},
				session
			);
	}
	private async run(
		task: ModuleTask,
		input: TaskRunInput,
		onFallback: (selection: TaskSelection) => void,
		executions: TaskExecution[]
	) {
		try {
			return { ...(await dispatchTaskAttempt(this.runner, input, executions)), fallback: false };
		} catch (error) {
			if (
				task.model !== 'auto' ||
				!error ||
				typeof error !== 'object' ||
				!('quotaRejected' in error) ||
				error.quotaRejected !== true
			)
				throw error;
			input.signal.throwIfAborted();
			const choice: TaskSelection = { provider: 'codex', model: 'gpt-6-luna', intelligence: 'max' };
			onFallback(choice);
			return {
				...(await dispatchTaskAttempt(
					this.runner,
					{
						...input,
						...choice
					},
					executions
				)),
				fallback: true
			};
		}
	}
}
