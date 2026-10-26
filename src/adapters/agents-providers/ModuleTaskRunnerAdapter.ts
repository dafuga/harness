import type {
	TaskRunInput,
	TaskRunResult,
	TaskRunner,
	TaskSelection
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	TaskFailureDiagnostic,
	ProviderFailureCategory,
	TaskProcessResult,
	TaskPublicEvent
} from './ModuleTaskRunnerAdapter.types';
import { taskProcess } from './module-task-runner-adapter/taskProcess';
import { taskUsage } from './module-task-runner-adapter/taskUsage';
/** Run the installed CLIs with saved login, exact model/effort and public output only. */
export class ModuleTaskRunnerAdapter implements TaskRunner {
	constructor(private readonly execute = taskProcess) {}
	command(selection: TaskSelection): string[] {
		if (selection.provider === 'claude') return claudeTaskCommand(selection);
		// prettier-ignore
		return [
			'codex', 'exec', '--json', '--ephemeral', '--sandbox', 'workspace-write',
			'-m', selection.model, '-c', `model_reasoning_effort=${JSON.stringify(selection.intelligence)}`,
			'-c', 'model_provider="openai"', '-c', 'approval_policy="never"', '-'
		];
	}
	async run(input: TaskRunInput): Promise<TaskRunResult> {
		const process = await this.execute(this.command(input), input);
		let events: TaskPublicEvent[];
		try {
			events = parseEvents(process.stdout);
		} catch {
			throw taskFailure(
				input.provider,
				[],
				process.stderr,
				'The selected CLI returned malformed structured output.',
				'invalid-response'
			);
		}
		const usage = taskUsage(input.provider, events);
		try {
			const result =
				input.provider === 'claude'
					? this.claude(events, process, input)
					: this.codex(events, process, input);
			return { ...result, usage };
		} catch (error) {
			const reportedModel =
				events.find((e) => e.type === 'system' && e.subtype === 'init')?.model ?? null;
			throw Object.assign(error instanceof Error ? error : new Error('Task execution failed.'), {
				usage,
				reportedModel
			});
		}
	}
	private claude(
		events: TaskPublicEvent[],
		process: TaskProcessResult,
		input: TaskRunInput
	): TaskRunResult {
		const result = [...events].reverse().find((e) => e.type === 'result');
		if (process.code !== 0 || !result || result.is_error) {
			const quotaRejected = events.some(rejectedQuotaEvent);
			if (quotaRejected)
				throw Object.assign(new Error('Claude quota exhausted.'), { quotaRejected });
			throw taskFailure(
				input.provider,
				events,
				process.stderr,
				'Claude task failed; inspect CLI authentication, permissions or model access.'
			);
		}
		return completedClaudeTask(events, result, input);
	}
	private codex(
		events: TaskPublicEvent[],
		process: TaskProcessResult,
		input: TaskRunInput
	): TaskRunResult {
		const result = [...events].reverse().find((e) => e.type === 'turn.completed');
		if (
			process.code !== 0 ||
			!result ||
			events.some((e) => ['turn.failed', 'error'].includes(e.type))
		)
			throw taskFailure(
				input.provider,
				events,
				process.stderr,
				'Codex task failed; inspect CLI authentication, permissions or model access.'
			);
		if (result.model && result.model !== input.model)
			throw taskFailure(input.provider, [], undefined, 'Wrong model.', 'model-access');
		return {
			provider: input.provider,
			model: input.model,
			intelligence: input.intelligence,
			reportedModel: result.model ?? null,
			text: codexText(events)
		};
	}
}
function claudeTaskCommand(selection: TaskSelection): string[] {
	// prettier-ignore
	return [
		'claude', '-p', '--verbose',
		'--output-format', 'stream-json', '--model', selection.model,
		'--effort', selection.intelligence, '--permission-mode', 'acceptEdits',
		'--tools', 'Read,Edit,Write,Glob,Grep,Bash', '--allowedTools', 'Read,Edit,Write,Glob,Grep,Bash',
		'--no-session-persistence'
	];
}
function rejectedQuotaEvent(event: TaskPublicEvent): boolean {
	if (event.type === 'rate_limit_event' && event.rate_limit_info?.status === 'rejected')
		return true;
	if (event.type === 'assistant' && event.error === 'rate_limit') return true;
	return typeof event.error === 'object' && event.error?.type === 'rate_limit_error';
}
function parseEvents(stdout: string): TaskPublicEvent[] {
	const events = stdout
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as TaskPublicEvent);
	if (
		!events.length ||
		events.some((event) => !event || typeof event.type !== 'string' || !event.type)
	)
		throw new Error('Invalid structured response.');
	return events;
}
function taskFailure(
	provider: 'claude' | 'codex',
	events: TaskPublicEvent[],
	stderr: string | undefined,
	fallback: string,
	fallbackCategory?: ProviderFailureCategory
): Error {
	const category = providerFailureCategory(events, stderr) ?? fallbackCategory;
	if (!category)
		return provider === 'claude'
			? Object.assign(new Error(fallback), { quotaRejected: false })
			: new Error(fallback);
	const nextAction = (
		{
			authentication: 'Sign in to the selected provider on this host, then retry.',
			'model-access': "Confirm the exact model ID and this host's model access, then retry.",
			permission: "Review the task's granted permissions, then retry.",
			'invalid-response': 'Check the installed CLI version and structured output mode, then retry.'
		} satisfies Record<ProviderFailureCategory, string>
	)[category];
	return Object.assign(new Error(`${category} failure. ${nextAction}`), {
		quotaRejected: false,
		diagnostic: {
			category,
			phase: category === 'invalid-response' ? 'response' : 'provider',
			nextAction
		} satisfies TaskFailureDiagnostic
	});
}
function providerFailureCategory(
	events: TaskPublicEvent[],
	stderr?: string
): ProviderFailureCategory | null {
	const fields = JSON.stringify(
		events.map(({ message, code, error, errors }) => ({ message, code, error, errors }))
	);
	const text = `${stderr ?? ''} ${fields}`.toLowerCase().replace(/[_-]+/g, ' ');
	const has = (terms: string) => terms.split('|').some((term) => text.includes(term));
	if (
		has(
			'unknown model|model not found|model unavailable|model not available|unsupported model|model not enabled|model access denied|no access to model|not authorized to use model'
		)
	)
		return 'model-access';
	if (
		has(
			'401|unauthorized|not authenticated|authentication|invalid api key|api key|key is invalid|key missing|token expired|expired token|token invalid|refresh token|invalid grant|oauth|credential|session expired|not signed in|signed out|sign in required|login required|please log in'
		)
	)
		return 'authentication';
	return events.some((event) => event.permission_denials?.length) ||
		has(
			'403|permission|not permitted|forbidden|access denied|approval required|tool denied|operation denied|sandbox restriction'
		)
		? 'permission'
		: null;
}
function codexText(events: TaskPublicEvent[]): string {
	return events
		.filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')
		.map((event) => event.item?.text ?? '')
		.join('\n')
		.slice(-16000);
}
function completedClaudeTask(
	events: TaskPublicEvent[],
	result: TaskPublicEvent,
	input: TaskRunInput
): TaskRunResult {
	const reported = events.find((e) => e.type === 'system' && e.subtype === 'init')?.model ?? null;
	if (result.permission_denials?.length)
		throw taskFailure(input.provider, [result], undefined, 'Permission denied.', 'permission');
	if (
		reported !== input.model ||
		Object.keys(result.modelUsage ?? {}).some((model) => model !== input.model)
	)
		throw taskFailure(input.provider, [], undefined, 'Wrong model.', 'model-access');
	return {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		text: (result.result ?? '').slice(-16000),
		reportedModel: reported
	};
}
