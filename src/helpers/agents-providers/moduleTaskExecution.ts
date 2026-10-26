import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { ModuleTaskRunnerAdapter } from '../../adapters/agents-providers/ModuleTaskRunnerAdapter';
import { ModuleTaskContractContextService } from '../../services/agents-providers/ModuleTaskContractContextService';
import { dispatchTaskAttempt } from '../../services/agents-providers/module-task-worker-service/dispatchTaskAttempt';
import {
	taskWorkspace,
	snapshotTaskWork
} from '../../services/agents-providers/module-task-worker-service/taskWorkspace';
import { moduleTaskPrompt } from '../../services/agents-providers/module-task-service/taskPrompt';
import type {
	ModuleTask,
	TaskRunner,
	TaskSelection,
	TaskExecution,
	TaskRunInput,
	TaskRunScope
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import { ModuleTaskService } from '../../services/agents-providers/ModuleTaskService';
import { pendingTaskResult } from '../../services/agents-providers/module-task-worker-service/taskClaim';
import type { ClaimedTaskExecution, ExecutionResult } from './moduleTaskExecution.types';
export type { ClaimedTaskExecution } from './moduleTaskExecution.types';
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
export async function executeClaimedTask(input: ClaimedTaskExecution): Promise<ExecutionResult> {
	const { root, task, signal, preflight } = input;
	let result: ExecutionResult = {
		...pendingTaskResult(preflight.selection, ''),
		attempt: task.claim!.token,
		sourceCommit: task.repairCommit ?? task.sourceCommit
	};
	let composing = false;
	try {
		signal.throwIfAborted();
		let sourceCommit = result.sourceCommit;
		if (input.checkpoints.length) {
			composing = true;
			sourceCommit = await input.dependencyBase.resolve({
				sourceCommit: task.sourceCommit,
				checkpoints: [...input.checkpoints, ...(task.repairCommit ? [task.repairCommit] : [])]
			});
			composing = false;
		}
		signal.throwIfAborted();
		const effective = { ...task, sourceCommit, repairCommit: undefined };
		const prepared = {
			...preflight,
			prompt: moduleTaskPrompt(effective, input.commit, preflight.files, preflight.role)
		};
		result.sourceCommit = sourceCommit;
		result = await taskWorkspace(root, effective, prepared.selection);
		await new GitAdapter(root).run(['worktree', 'add', '--detach', result.worktree, sourceCommit]);
		result = await runWithContractContext(
			root,
			input.runner,
			input.contexts,
			effective,
			prepared,
			result,
			signal
		);
	} catch (error) {
		result.error = composing
			? 'Task dependency composition failed.'
			: !result.worktree
				? 'Task workspace preparation failed.'
				: error instanceof Error && error.message
					? error.message
					: 'Task worker failed.';
	}
	result.finishedAt = new Date().toISOString();
	return result;
}
/** @pure */
export function moduleTaskExecution(textToFormat: string): string {
	if (typeof textToFormat !== 'string') throw new TypeError('moduleTaskExecution expects text');
	return textToFormat.trim();
}
