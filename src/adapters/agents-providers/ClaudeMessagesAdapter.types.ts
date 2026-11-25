// @harness-uid u_kg5hqg2wxy
import type { UntrustedValue } from '../../core/agents-providers/projectAssistant.types';

export type ClaudeBlock =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, UntrustedValue> }
	| { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ClaudeMessage {
	role: 'user' | 'assistant';
	content: string | ClaudeBlock[];
}

export interface ClaudeToolSpec {
	name: string;
	description: string;
	input_schema: Readonly<Record<string, unknown>>;
}

export interface ClaudeTurn {
	stopReason: string;
	content: ClaudeBlock[];
}

export interface ClaudeMessagesAdapterConfig {
	model: string;
	maxTokens: number;
	/** Supplies the API key only for one request. */
	withKey<T>(use: (apiKey: string) => Promise<T>): Promise<T>;
	fetch?: typeof fetch;
}
