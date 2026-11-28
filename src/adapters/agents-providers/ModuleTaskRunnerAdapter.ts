// @harness-uid u_rw64iex44n
import type {
	TaskRunInput,
	TaskRunResult,
	TaskRunner,
	TaskSelection
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskProcessExecutor, TaskPublicEvent } from './ModuleTaskRunnerAdapter.types';
import { ModuleTaskRunError } from './ModuleTaskRunnerAdapter.types';
import { taskProcess } from './module-task-runner-adapter/taskProcess';
import { managedTaskSessions } from './module-task-runner-adapter/managedTaskSessions';
import { completeOrchestration } from '../../services/agents-providers/completion-hooks/orchestratorCompletion';
import { completionTurn } from '../../services/agents-providers/completion-hooks/completionRun';
import type { CompletionTurnInput } from '../../services/agents-providers/completion-hooks/completionRun.types';
import {
	codexTaskCommand,
	type CodexTaskSelection
} from './module-task-runner-adapter/codexTaskCommand';
/** Run the installed CLIs with saved login, exact model/effort and public output only. */
export class ModuleTaskRunnerAdapter implements TaskRunner {
	constructor(private readonly execute: TaskProcessExecutor = taskProcess) {}
	command(selection: CodexTaskSelection): string[] {
		if (selection.provider === 'claude') return claudeTaskCommand(selection);
		return codexTaskCommand(selection);
	}
	async run(input: TaskRunInput): Promise<TaskRunResult> {
		if (input.supervision) return completeOrchestration(input, (task) => this.runProvider(task));
		return this.runProvider(input);
	}
	private runProvider(input: CompletionTurnInput): Promise<TaskRunResult> {
		const completion = input[completionTurn];
		return managedTaskSessions(
			input,
			(current) =>
				this.execute(
					completionCommand(this.command(current), current.provider, completion === true),
					taskImageInput(current)
				),
			(events, code, current) =>
				current.provider === 'claude'
					? this.claude(events, code, current)
					: this.codex(events, code, current, completion !== undefined)
		);
	}
	private claude(events: TaskPublicEvent[], code: number, input: TaskRunInput): TaskRunResult {
		const result = [...events].reverse().find((e) => e.type === 'result');
		if (code !== 0 || !result || result.is_error) {
			const quotaRejected = events.some(rejectedQuotaEvent);
			throw Object.assign(
				new ModuleTaskRunError(
					quotaRejected
						? 'Claude quota exhausted.'
						: 'Claude task failed; inspect CLI authentication, permissions or model access.'
				),
				{ quotaRejected, quotaResetsAt: quotaReset(events) }
			);
		}
		return completedClaudeTask(events, result, input);
	}
	private codex(
		events: TaskPublicEvent[],
		code: number,
		input: TaskRunInput,
		finalMessageOnly: boolean
	): TaskRunResult {
		const result = [...events].reverse().find((e) => e.type === 'turn.completed');
		if (code !== 0 || !result || events.some((e) => ['turn.failed', 'error'].includes(e.type)))
			throw new ModuleTaskRunError(
				'Codex task failed; inspect CLI authentication, permissions or model access.'
			);
		if (result.model && result.model !== input.model)
			throw new ModuleTaskRunError('Codex ran a different model.');
		const messages = events
			.filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message')
			.map((e) => e.item!.text ?? '');
		return {
			provider: input.provider,
			model: input.model,
			intelligence: input.intelligence,
			reportedModel: result.model ?? null,
			text: (finalMessageOnly ? (messages.at(-1) ?? '') : messages.join('\n')).slice(-16000)
		};
	}
}
function taskImageInput(input: TaskRunInput): TaskRunInput {
	if (input.provider !== 'claude' || !input.images?.length) return input;
	return {
		...input,
		prompt:
			input.prompt +
			'\n\nRead these extracted frame images before editing:\n' +
			input.images.map((path) => JSON.stringify(path)).join('\n')
	};
}
function completionCommand(
	command: string[],
	provider: TaskSelection['provider'],
	readOnly: boolean
): string[] {
	if (!readOnly) return command;
	const flags = provider === 'claude' ? ['--tools', '--allowedTools'] : ['--sandbox'];
	const setting = provider === 'claude' ? 'Read,Glob,Grep' : 'read-only';
	return command.map((part, index) => (flags.includes(command[index - 1]) ? setting : part));
}
function claudeTaskCommand(selection: TaskSelection): string[] {
	return [
		'claude',
		'-p',
		'--verbose',
		'--output-format',
		'stream-json',
		'--include-partial-messages',
		'--model',
		selection.model,
		'--effort',
		selection.intelligence,
		'--permission-mode',
		'acceptEdits',
		'--tools',
		'Read,Edit,Write,Glob,Grep,Bash',
		'--allowedTools',
		'Read,Edit,Write,Glob,Grep,Bash',
		'--no-session-persistence'
	];
}
function quotaReset(events: TaskPublicEvent[]): number | undefined {
	return events.find((event) => typeof event.rate_limit_info?.resetsAt === 'number')
		?.rate_limit_info?.resetsAt;
}
function rejectedQuotaEvent(event: TaskPublicEvent): boolean {
	if (event.type === 'rate_limit_event' && event.rate_limit_info?.status === 'rejected')
		return true;
	if (event.type === 'assistant' && event.error === 'rate_limit') return true;
	return typeof event.error === 'object' && event.error?.type === 'rate_limit_error';
}
function completedClaudeTask(
	events: TaskPublicEvent[],
	result: TaskPublicEvent,
	input: TaskRunInput
): TaskRunResult {
	const reported = events.find((e) => e.type === 'system' && e.subtype === 'init')?.model ?? null;
	if (result.permission_denials?.length)
		throw new ModuleTaskRunError(
			'Claude was denied a required tool; review the preserved worktree.'
		);
	if (
		reported !== input.model ||
		Object.keys(result.modelUsage ?? {}).some((model) => model !== input.model)
	)
		throw new ModuleTaskRunError('Claude ran a different model.');
	return {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		text: (result.result ?? '').slice(-16000),
		reportedModel: reported
	};
}
