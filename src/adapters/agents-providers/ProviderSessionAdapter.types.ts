// @harness-uid u_jqwsplz2qq
import type { TaskUsage } from '../../repositories/agents-providers/ModuleTaskRepository.types';

export interface SessionObservation {
	sessionId: string | null;
	peakContextTokens: number | null;
	usage?: TaskUsage;
}

export interface ClaudeMessage {
	id?: string;
	usage?: Record<string, unknown>;
}

export interface LiveProviderEvent {
	type?: string;
	thread_id?: string;
	session_id?: string;
	message?: ClaudeMessage;
	event?: { type?: string; message?: ClaudeMessage; usage?: Record<string, unknown> };
}

export interface TokenCountEvent {
	type?: string;
	info?: {
		last_token_usage?: Record<string, unknown>;
		total_token_usage?: Record<string, unknown>;
	};
}
