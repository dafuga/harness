// @harness-uid u_kg5hqn7mno
import type { ClaudeMessagesAdapter } from '../../adapters/agents-providers/ClaudeMessagesAdapter';
import type {
	AssistantQuestion,
	AssistantToolDefinition,
	ProjectAssistantConfig
} from '../../core/agents-providers/projectAssistant.types';

export interface ProjectAssistantServiceConfig {
	config: ProjectAssistantConfig;
	model: Pick<ClaudeMessagesAdapter, 'turn'>;
	tools: readonly AssistantToolDefinition[];
	requestTools?(question: AssistantQuestion): readonly AssistantToolDefinition[];
	maxToolRounds?: number;
}
