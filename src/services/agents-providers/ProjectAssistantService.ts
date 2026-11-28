// @harness-uid u_kg5hqn7mno
import type {
	ClaudeBlock,
	ClaudeMessage
} from '../../adapters/agents-providers/ClaudeMessagesAdapter';
import type {
	AssistantAnswer,
	AssistantQuestion,
	AssistantSource,
	AssistantToolDefinition
} from '../../core/agents-providers/projectAssistant.types';
import { redactSecrets } from '../../utils/agents-providers/redactSecrets';
import { runAssistantTools } from './project-assistant-service/runAssistantTools';
import { assistantSystemPrompt } from './project-assistant-service/assistantPrompt';
import type { ProjectAssistantServiceConfig } from './ProjectAssistantService.types';

const maxText = 3500;
const maxSources = 6;

/** Answers one question with read-only tools. Write tools run only for writers, on the first model turn. */
export class ProjectAssistantService {
	constructor(private readonly options: ProjectAssistantServiceConfig) {}

	toolNames(): string[] {
		return this.options.tools.map((tool) => tool.name);
	}

	async answer(question: AssistantQuestion): Promise<AssistantAnswer> {
		const { config, model } = this.options;
		const writer = question.allowWrite !== false && config.writers.includes(question.senderId);
		const tools = [
			...this.options.tools.filter((tool) => writer || !tool.write),
			...(this.options.requestTools?.(question) ?? []).filter((tool) => !tool.write)
		];
		const specs = tools.map(toolSpec);
		const messages: ClaudeMessage[] = [
			...(question.history ?? [])
				.slice(-8)
				.map((m) => ({ ...m, content: redactSecrets(m.content).slice(0, 1500) })),
			{ role: 'user', content: redactSecrets(question.text).slice(0, 2000) }
		];
		const sources: AssistantSource[] = [];
		const called: string[] = [];
		const system = assistantSystemPrompt(config.displayName, writer);
		for (let round = 0; round <= (this.options.maxToolRounds ?? 6); round++) {
			const turn = await model.turn(system, messages, specs);
			const uses = turn.content.filter((b) => b.type === 'tool_use');
			if (turn.stopReason !== 'tool_use' || uses.length === 0)
				return this.finish(turn.content, sources, called);
			messages.push({ role: 'assistant', content: turn.content });
			const results = await runAssistantTools(uses, {
				tools,
				firstRound: round === 0,
				sources,
				called
			});
			messages.push({ role: 'user', content: results });
		}
		return this.finish([], sources, called);
	}

	private finish(
		content: ClaudeBlock[],
		sources: AssistantSource[],
		called: string[]
	): AssistantAnswer {
		const body = content
			.flatMap((b) => (b.type === 'text' ? [b.text] : []))
			.join('\n')
			.trim();
		const text =
			redactSecrets(body).slice(0, maxText) || 'I could not find an answer with the tools I have.';
		const unique = [...new Map(sources.map((s) => [s.url, s])).values()].slice(0, maxSources);
		const links = unique
			.filter((s) => /^https:\/\/[^<>|\s]+$/.test(s.url))
			.map((s) => `<${s.url}|${s.label.replace(/[<>|]/g, '')}>`)
			.join(' · ');
		return {
			text: links ? `${text}\n\n*Sources* ${links}` : text,
			sources: unique,
			toolCalls: called
		};
	}
}

function toolSpec(tool: AssistantToolDefinition) {
	return { name: tool.name, description: tool.description, input_schema: tool.input };
}

export type { ProjectAssistantServiceConfig } from './ProjectAssistantService.types';
