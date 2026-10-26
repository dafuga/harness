import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { ModuleTaskAnalyticsService } from './ModuleTaskAnalyticsService';
import { ModuleTaskContractContextService } from './ModuleTaskContractContextService';
import { dispatchTaskAttempt } from './module-task-worker-service/dispatchTaskAttempt';
import { taskWorkspace, snapshotTaskWork } from './module-task-worker-service/taskWorkspace';
import { moduleTaskPrompt } from './module-task-service/taskPrompt';
import type {
	ModuleTask,
	TaskRunner,
	TaskSelection,
	TaskExecution,
	TaskRunInput,
	TaskRunScope
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskRepository } from '../../repositories/agents-providers/ModuleTaskRepository';
import { ModuleTaskService } from './ModuleTaskService';
import { claimedTask, finishTask, pendingTaskResult } from './module-task-worker-service/taskClaim';
async function runTaskAttempts(
	runner: TaskRunner,
	task: ModuleTask,
	input: TaskRunInput & { scope: TaskRunScope },
	onFallback: (selection: TaskSelection) => void,
	executions: TaskExecution[]
) {
	try {
		return { ...(await dispatchTaskAttempt(runner, input, executions)), fallback: false };
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
			...(await dispatchTaskAttempt(runner, { ...input, ...choice }, executions)),
			fallback: true
		};
	}
}
async function executeScopedTask(
	runner: TaskRunner,
	task: ModuleTask,
	prepared: ReturnType<ModuleTaskService['prepare']>,
	result: Awaited<ReturnType<typeof taskWorkspace>>,
	signal: AbortSignal,
	scope: TaskRunScope
) {
	let current = result;
	try {
		const execution = await runTaskAttempts(
			runner,
			task,
			{
				...prepared.selection,
				cwd: result.worktree,
				prompt: prepared.prompt,
				signal,
				scope
			},
			(choice) => {
				current = { ...current, ...choice, fallback: true };
			},
			result.executions
		);
		return { ...current, ...execution };
	} catch (error) {
		current.error = error instanceof Error ? error.message : 'Task worker failed.';
		return current;
	}
}
async function cleanupTaskContext(
	context: Awaited<ReturnType<ModuleTaskContractContextService['create']>>,
	result: Awaited<ReturnType<typeof taskWorkspace>>
) {
	try {
		await context.cleanup();
	} catch {
		result.error = result.error
			? `${result.error} Contract context cleanup failed.`
			: 'Harness contract context cleanup failed.';
	}
	return result;
}
async function snapshotPreparedTask(
	root: string,
	task: ModuleTask,
	prepared: ReturnType<ModuleTaskService['prepare']>,
	result: Awaited<ReturnType<typeof taskWorkspace>>
) {
	if (result.error) return result;
	try {
		await snapshotTaskWork(
			root,
			{ ...task, module: { ...task.module, files: prepared.files } },
			result
		);
	} catch (error) {
		result.error = error instanceof Error ? error.message : 'Task worker failed.';
	}
	return result;
}
async function runWithContractContext(
	root: string,
	runner: TaskRunner,
	contexts: Pick<ModuleTaskContractContextService, 'create'>,
	task: ModuleTask,
	prepared: ReturnType<ModuleTaskService['prepare']>,
	result: Awaited<ReturnType<typeof taskWorkspace>>,
	signal: AbortSignal
) {
	let context: Awaited<ReturnType<ModuleTaskContractContextService['create']>>;
	try {
		context = await contexts.create(
			{ ...task, sourceCommit: result.sourceCommit },
			result.worktree,
			prepared.files
		);
	} catch {
		result.error = 'Harness contract context unavailable.';
		return result;
	}
	const execution = await executeScopedTask(runner, task, prepared, result, signal, context.scope);
	const cleaned = await cleanupTaskContext(context, execution);
	return snapshotPreparedTask(root, task, prepared, cleaned);
}
function workerResult(task: ModuleTask, result: Awaited<ReturnType<typeof taskWorkspace>>) {
	return {
		status: result.error ? ('failed' as const) : ('review' as const),
		task: task.id,
		result
	};
}

/** Foreground workers claim atomically in a shared Git repository and preserve isolated review work. */
export class ModuleTaskWorkerService {
	private readonly repository: ModuleTaskRepository;
	constructor(
		private readonly root = process.cwd(),
		private readonly runner: TaskRunner = new ModuleTaskRunnerAdapter(),
		private readonly contexts: Pick<
			ModuleTaskContractContextService,
			'create'
		> = new ModuleTaskContractContextService(root)
	) {
		this.repository = new ModuleTaskRepository(root);
	}
	async once(worker: string, modules: string[] = [], signal = AbortSignal.timeout(900000)) {
		if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(worker))
			throw new Error('Worker must be a lowercase dotted or dashed identifier.');
		signal.throwIfAborted();
		const owner = await this.repository.owner();
		signal.throwIfAborted();
		const service = new ModuleTaskService(this.root);
		let prepared: ReturnType<ModuleTaskService['prepare']> | undefined;
		const claim = await this.repository.update((queue) => {
			signal.throwIfAborted();
			return claimedTask(queue, worker, modules, owner, (task) => {
				const candidate = service.prepare(task, task.sourceCommit);
				prepared = {
					...candidate,
					selection: { ...candidate.selection },
					files: [...candidate.files]
				};
			});
		});
		if (!claim.value) return { status: 'idle' as const };
		return this.execute(claim.value, claim.commit!, signal, prepared!);
	}
	private async execute(
		task: ModuleTask,
		commit: string,
		signal: AbortSignal,
		preflight: ReturnType<ModuleTaskService['prepare']>
	) {
		const prepared = {
			...preflight,
			prompt: moduleTaskPrompt(task, commit, preflight.files, preflight.role)
		};
		let result: Awaited<ReturnType<typeof taskWorkspace>> = {
			...pendingTaskResult(prepared.selection, ''),
			attempt: task.claim!.token,
			sourceCommit: task.repairCommit ?? task.sourceCommit
		};
		try {
			result = await taskWorkspace(this.root, task, prepared.selection);
			const addWorktree = ['worktree', 'add', '--detach', result.worktree, result.sourceCommit];
			await new GitAdapter(this.root).run(addWorktree);
			result = await runWithContractContext(
				this.root,
				this.runner,
				this.contexts,
				task,
				prepared,
				result,
				signal
			);
		} catch (error) {
			result.error = !result.worktree
				? 'Task workspace preparation failed.'
				: error instanceof Error && error.message
					? error.message
					: 'Task worker failed.';
		}
		result.finishedAt = new Date().toISOString();
		await this.repository.update(
			(queue) => finishTask(queue, task, result),
			result.checkpointCommit
		);
		await new ModuleTaskAnalyticsService().sync(this.root);
		return workerResult(task, result);
	}
}
