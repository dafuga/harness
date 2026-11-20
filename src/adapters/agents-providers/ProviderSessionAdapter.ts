// @harness-uid u_jqwsplz2qq
import type {
	TaskSelection,
	TaskUsage
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	ClaudeMessage,
	LiveProviderEvent,
	SessionObservation,
	TokenCountEvent
} from './ProviderSessionAdapter.types';
import { CodexRolloutReader, findCodexRollout } from './provider-session-adapter/codexRollout';
import { taskUsage } from './module-task-runner-adapter/taskUsage';
import { sumSessionUsage } from './provider-session-adapter/sumSessionUsage';

/** Consume provider usage without forwarding prompts or raw transcript rows. */
export class ProviderSessionAdapter {
	private readonly startedAt = Date.now();
	private readonly rollout = new CodexRolloutReader();
	private readonly claudeUsage = new Map<string, TaskUsage>();
	private rolloutPath?: string;
	private claudeMessage?: ClaudeMessage;
	private state: SessionObservation = { sessionId: null, peakContextTokens: null };

	constructor(
		private readonly provider: TaskSelection['provider'],
		private readonly codexHome: string
	) {}

	event(line: string): void {
		const event = providerEvent(line);
		if (!event) return;
		if (this.provider === 'codex') {
			if (event.type === 'thread.started' && event.thread_id && !this.state.sessionId)
				this.state.sessionId = event.thread_id;
			return;
		}
		if (event.session_id) this.state.sessionId ??= event.session_id;
		if (event.type === 'assistant') this.observeClaude(event.message);
		if (event.type === 'stream_event') this.observeClaudeStream(event.event);
	}

	sample(): SessionObservation {
		if (this.provider === 'codex' && this.state.sessionId) {
			this.rolloutPath ??= findCodexRollout(this.codexHome, this.state.sessionId, this.startedAt);
			if (this.rolloutPath)
				this.rollout.read(this.rolloutPath, (event) => this.observeCodex(event));
		}
		return { ...this.state };
	}

	summary(): SessionObservation {
		return {
			...this.state,
			usage:
				this.provider === 'claude'
					? sumSessionUsage([...this.claudeUsage.values()])
					: this.state.usage
		};
	}

	private observeClaudeStream(event: LiveProviderEvent['event']): void {
		if (event?.type === 'message_start') this.claudeMessage = event.message;
		if (event?.type === 'message_delta' && this.claudeMessage)
			this.claudeMessage = {
				...this.claudeMessage,
				usage: { ...this.claudeMessage.usage, ...event.usage }
			};
		this.observeClaude(this.claudeMessage);
	}

	private observeClaude(message: ClaudeMessage | undefined): void {
		if (!message?.id || !message.usage) return;
		const usage = taskUsage('claude', [{ type: 'result', usage: message.usage }]);
		this.claudeUsage.set(message.id, usage);
		const input = message.usage.input_tokens;
		if (typeof input === 'number' && Number.isSafeInteger(input) && input >= 0)
			this.observePeak(input + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0));
	}

	private observeCodex(event: TokenCountEvent): void {
		const input = event.info?.last_token_usage?.input_tokens;
		if (typeof input === 'number' && Number.isSafeInteger(input) && input > 0)
			this.observePeak(input);
		if (event.info?.total_token_usage)
			this.state.usage = taskUsage('codex', [
				{ type: 'turn.completed', usage: event.info.total_token_usage }
			]);
	}

	private observePeak(input: number | null): void {
		if (input !== null)
			this.state.peakContextTokens = Math.max(input, this.state.peakContextTokens ?? 0);
	}
}

function providerEvent(line: string): LiveProviderEvent | undefined {
	if (!line) return undefined;
	try {
		return JSON.parse(line) ?? undefined;
	} catch {
		return undefined;
	}
}
