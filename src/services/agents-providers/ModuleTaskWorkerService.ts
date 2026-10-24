import { resolve } from 'node:path';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import type {
	ModuleTask,
	TaskRunner,
	TaskSelection
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { ModuleTaskService } from './ModuleTaskService';
import { claimedTask, finishTask, taskWrites } from './module-task-worker-service/taskClaim';
/** Foreground workers claim atomically in a shared Git repository and preserve isolated review work. */
export class ModuleTaskWorkerService {
	private readonly repository: ModuleTaskRepository;
	constructor(
		private readonly root = process.cwd(),
		private readonly runner: TaskRunner = new ModuleTaskRunnerAdapter()
	) {
		this.repository = new ModuleTaskRepository(root);
	}
	async once(worker: string, modules: string[] = [], signal = AbortSignal.timeout(900000)) {
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(worker))
			throw new Error('Worker must be a lowercase dotted or dashed identifier.');
		const claim = await this.repository.update((queue) => claimedTask(queue, worker, modules));
		if (!claim.value) return { status: 'idle' as const };
		return this.execute(claim.value, claim.commit!, signal);
	}
	private async execute(task: ModuleTask, commit: string, signal: AbortSignal) {
		const git = new GitAdapter(this.root),
			{ selection, prompt } = new ModuleTaskService(this.root).prepare(task, commit);
		const common = await git.run(['rev-parse', '--git-common-dir']);
		const worktree = resolve(this.root, common, 'harness', 'task-worktrees', task.claim!.token);
		let result: ModuleTask['result'] = {
			...selection,
			reportedModel: null,
			text: '',
			worktree,
			changedFiles: [],
			fallback: false,
			finishedAt: new Date().toISOString()
		};
		try {
			await git.run(['worktree', 'add', '--detach', worktree, task.sourceCommit]);
			const execution = await this.run(task, { ...selection, cwd: worktree, prompt, signal });
			result = { ...result, ...execution };
			result.changedFiles = await taskWrites(new GitAdapter(worktree), task);
		} catch (error) {
			result.error = error instanceof Error ? error.message : 'Task worker failed.';
		}
		result.finishedAt = new Date().toISOString();
		await this.repository.update((queue) => finishTask(queue, task, result));
		return {
			status: result.error ? ('failed' as const) : ('review' as const),
			task: task.id,
			result
		};
	}
	private async run(
		task: ModuleTask,
		input: TaskSelection & { cwd: string; prompt: string; signal: AbortSignal }
	) {
		try {
			return { ...(await this.runner.run(input)), fallback: false };
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
			return {
				...(await this.runner.run({
					...input,
					provider: 'codex',
					model: 'gpt-6-luna',
					intelligence: 'max'
				})),
				fallback: true
			};
		}
	}
}
