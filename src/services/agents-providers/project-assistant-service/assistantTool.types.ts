// @harness-uid u_kg5hqt7efg
import type {
	AssistantSource,
	AssistantToolDefinition,
	UntrustedValue
} from '../../../core/agents-providers/projectAssistant.types';

export type ToolInput = Record<string, UntrustedValue>;

/** Shorthand for a tool's input: `{ field: 'type' | 'a|b' }` plus which are required. */
export interface ToolShape {
	fields: Record<string, string>;
	required?: string[];
	write?: boolean;
}

export interface ToolRound {
	tools: readonly AssistantToolDefinition[];
	/** Writes are allowed only straight from the request, before any tool result was read. */
	firstRound: boolean;
	sources: AssistantSource[];
	called: string[];
}
