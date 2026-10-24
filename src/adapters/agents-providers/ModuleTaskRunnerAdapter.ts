import type {
	TaskRunInput,
	TaskRunResult,
	TaskRunner,
	TaskSelection
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskPublicEvent } from './ModuleTaskRunnerAdapter.types';
import { taskProcess } from './module-task-runner-adapter/taskProcess';
/** Run the installed CLIs with saved login, exact model/effort and public output only. */
export class ModuleTaskRunnerAdapter implements TaskRunner {
	constructor(private readonly execute = taskProcess) {}
	command(selection: TaskSelection): string[] {
		if (selection.provider === 'claude') return claudeTaskCommand(selection);
		return [
			'codex',
			'exec',
			'--json',
			'--ephemeral',
			'--sandbox',
			'workspace-write',
			'-m',
			selection.model,
			'-c',
			`model_reasoning_effort=${JSON.stringify(selection.intelligence)}`,
			'-c',
			'model_provider="openai"',
			'-c',
			'approval_policy="never"',
			'-'
		];
	}
	async run(input: TaskRunInput): Promise<TaskRunResult> {
		const process = await this.execute(this.command(input), input);
		const events = process.stdout
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as TaskPublicEvent);
		return input.provider === 'claude'
			? this.claude(events, process.code, input)
			: this.codex(events, process.code, input);
	}
	private claude(events: TaskPublicEvent[], code: number, input: TaskRunInput): TaskRunResult {
		const result = [...events].reverse().find((e) => e.type === 'result');
		if (code !== 0 || !result || result.is_error) {
			const quotaRejected = events.some(
				(e) =>
					(e.type === 'rate_limit_event' && e.rate_limit_info?.status === 'rejected') ||
					(e.type === 'assistant' && e.error === 'rate_limit') ||
					(typeof e.error === 'object' && e.error?.type === 'rate_limit_error')
			);
			throw Object.assign(
				new Error(
					quotaRejected
						? 'Claude quota exhausted.'
						: 'Claude task failed; inspect CLI authentication, permissions or model access.'
				),
				{ quotaRejected }
			);
		}
		const reported = events.find((e) => e.type === 'system' && e.subtype === 'init')?.model ?? null;
		if (result.permission_denials?.length)
			throw new Error('Claude was denied a required tool; review the preserved worktree.');
		if (
			reported !== input.model ||
			Object.keys(result.modelUsage ?? {}).some((model) => model !== input.model)
		)
			throw new Error('Claude ran a different model.');
		return {
			provider: input.provider,
			model: input.model,
			intelligence: input.intelligence,
			text: (result.result ?? '').slice(-16000),
			reportedModel: reported
		};
	}
	private codex(events: TaskPublicEvent[], code: number, input: TaskRunInput): TaskRunResult {
		const result = [...events].reverse().find((e) => e.type === 'turn.completed');
		if (code !== 0 || !result || events.some((e) => ['turn.failed', 'error'].includes(e.type)))
			throw new Error(
				'Codex task failed; inspect CLI authentication, permissions or model access.'
			);
		if (result.model && result.model !== input.model)
			throw new Error('Codex ran a different model.');
		return {
			provider: input.provider,
			model: input.model,
			intelligence: input.intelligence,
			reportedModel: result.model ?? null,
			text: events
				.filter((e) => e.type === 'item.completed' && e.item?.type === 'agent_message')
				.map((e) => e.item!.text ?? '')
				.join('\n')
				.slice(-16000)
		};
	}
}
function claudeTaskCommand(selection: TaskSelection): string[] {
	return [
		'claude',
		'-p',
		'--verbose',
		'--output-format',
		'stream-json',
		'--model',
		selection.model,
		'--effort',
		selection.intelligence,
		'--permission-mode',
		'acceptEdits',
		'--tools',
		'Read,Edit,Write,Glob,Grep',
		'--no-session-persistence'
	];
}
