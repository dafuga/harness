// @harness-uid u_b4uzqkb2i6
import { WorkerOutsideModuleError } from './module-task-worker-service/taskClaim.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { TaskWorktreeChangedError } from '../../adapters/agents-providers/TaskWorktreeChangedError';
import { ModuleTaskAnalyticsService } from './ModuleTaskAnalyticsService';
import { dispatchTaskAttempt } from './module-task-worker-service/dispatchTaskAttempt';
import {
	taskWorkspace,
	snapshotTaskWork,
	prepareTaskWorkspace,
	taskFrameInputs
} from './module-task-worker-service/taskWorkspace';
import type {
	ModuleTask,
	TaskRunner,
	TaskSelection
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskRunInput } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { trackerHandoff } from '../../adapters/agents-providers/module-task-runner-adapter/trackerHandoff';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { ModuleTaskService } from './ModuleTaskService';
import { finishTask } from './module-task-worker-service/taskClaim';
import { preflightClaim } from './module-task-worker-service/preflightClaim';
import { taskCheckLoop } from './module-task-worker-service/taskCheckLoop';
import { recordCooldown } from './module-task-worker-service/providerCooldown';
/** Foreground workers claim atomically in a shared Git repository and preserve isolated review work. */
export class ModuleTaskWorkerService {
	private readonly repository: ModuleTaskRepository;
	constructor(
		private readonly root = process.cwd(),
		private readonly runner: TaskRunner = new ModuleTaskRunnerAdapter(),
		private readonly tracker?: string,
		private readonly allowTaskChecks?: boolean
	) {
		this.repository = new ModuleTaskRepository(root);
	}
	async once(
		worker: string,
		modules: string[] = [],
		signal: AbortSignal = AbortSignal.timeout(900000)
	) {
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(worker))
			throw new ExpectedCliError('Worker must be a lowercase dotted or dashed identifier.');
		const { claim, blocked } = await preflightClaim(this.root, this.repository, worker, {
			modules,
			allowTaskChecks: this.allowTaskChecks
		});
		if (!claim?.value)
			return blocked.length
				? { status: 'blocked' as const, problems: blocked }
				: { status: 'idle' as const };
		return this.execute(claim.value, claim.commit!, signal);
	}
	private async execute(task: ModuleTask, commit: string, signal: AbortSignal) {
		const { selection, prompt } = new ModuleTaskService(this.root).prepare(task, commit);
		const result = await taskWorkspace(this.root, task, selection);
		const { sourceCommit, worktree } = result;
		try {
			await new GitAdapter(this.root).run(['worktree', 'add', '--detach', worktree, sourceCommit]);
			await prepareTaskWorkspace(this.root, worktree);
			const inputs = await taskFrameInputs(this.root, task, worktree, prompt);
			const input = {
				...selection,
				cwd: worktree,
				...inputs,
				signal,
				platform: task.platform,
				onRotation: this.handoff(task, worktree)
			};
			await this.runChecked(task, input, result);
		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Task worker failed.';
			if (result.executions.at(-1)?.status !== 'failed')
				result.failureCause =
					error instanceof TaskWorktreeChangedError || error instanceof WorkerOutsideModuleError
						? 'scope'
						: 'workspace-error';
		}
		return this.finish(task, result);
	}

	private async finish(task: ModuleTask, result: Awaited<ReturnType<typeof taskWorkspace>>) {
		result.finishedAt = new Date().toISOString();
		await this.repository.update(
			(queue) => finishTask(queue, task, result),
			result.checkpointCommit
		);
		await new ModuleTaskAnalyticsService().sync(this.root);
		const status = result.error ? ('failed' as const) : ('review' as const);
		return { status, task: task.id, result };
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
	private async runChecked(
		task: ModuleTask,
		input: TaskRunInput,
		result: Awaited<ReturnType<typeof taskWorkspace>>
	) {
		const completion = { runner: this.runner, signal: input.signal };
		const error = await taskCheckLoop(task, input, result, async (turn) => {
			const execution = await this.run(task, turn, result);
			Object.assign(result, execution);
			return result.executions.at(-1)!;
		});
		if (error) {
			result.error = error;
			result.failureCause = 'check';
		}
		await snapshotTaskWork(this.root, task, result, error ? undefined : completion);
	}

	private async run(
		task: ModuleTask,
		input: TaskRunInput,
		result: Awaited<ReturnType<typeof taskWorkspace>>
	) {
		try {
			return await dispatchTaskAttempt(this.runner, input, result.executions);
		} catch (error) {
			const quota = quotaRejection(error);
			if (quota) await recordCooldown(this.root, input.provider, quota.resetsAt);
			if (task.model !== 'auto' || !quota || result.fallback) throw error;
			input.signal.throwIfAborted();
			const choice: TaskSelection =
				input.provider === 'codex'
					? { provider: 'claude', model: 'claude-haiku-5-5', intelligence: 'medium' }
					: { provider: 'codex', model: 'gpt-6-luna', intelligence: 'max' };
			Object.assign(result, choice, { fallback: true });
			const session = input.session ? {} : undefined;
			return dispatchTaskAttempt(this.runner, { ...input, ...choice, session }, result.executions);
		}
	}
}

/** A structured provider quota rejection, with the reset time the provider reported. */
function quotaRejection(error: unknown): { resetsAt?: number } | undefined {
	if (!error || typeof error !== 'object' || !('quotaRejected' in error)) return undefined;
	if (error.quotaRejected !== true) return undefined;
	const resetsAt = 'quotaResetsAt' in error ? error.quotaResetsAt : undefined;
	return { resetsAt: typeof resetsAt === 'number' ? resetsAt : undefined };
}
