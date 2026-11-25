import { describe, expect, test } from 'vitest';
import type {
	AssistantToolDefinition,
	ProjectAssistantConfig
} from '../../../src/core/agents-providers/projectAssistant.types';
import type {
	ClaudeBlock,
	ClaudeTurn
} from '../../../src/adapters/agents-providers/ClaudeMessagesAdapter';
import { ProjectAssistantService } from '../../../src/services/agents-providers/ProjectAssistantService';

const config: ProjectAssistantConfig = {
	project: 'demo',
	displayName: 'Demo',
	github: {
		owner: 'o',
		repo: 'r',
		appId: '1',
		installationId: '2',
		stagingBranch: 'staging',
		mainBranch: 'main'
	},
	tracker: { agent: 'demo', owner: 'Demo assistant' },
	health: {},
	writers: ['UWRITER'],
	answerChannels: ['C1'],
	answerDirectMessages: true
};

function tool(name: string, write: boolean, log: string[]): AssistantToolDefinition {
	return {
		name,
		description: name,
		input: { type: 'object' },
		write,
		run: async () => {
			log.push(name);
			return {
				text: 'token xoxb-1234567890-abcdef ok',
				sources: [{ label: 'x', url: 'https://github.com/o/r/issues/1' }]
			};
		}
	};
}

function scripted(turns: ClaudeTurn[], seen: { tools: string[][] } = { tools: [] }) {
	let index = 0;
	return {
		seen,
		model: {
			turn: async (_system: string, _messages: unknown, tools: readonly { name: string }[]) => {
				seen.tools.push(tools.map((t) => t.name));
				return (
					turns[index++] ?? {
						stopReason: 'end_turn',
						content: [{ type: 'text', text: 'done' } satisfies ClaudeBlock]
					}
				);
			}
		}
	};
}

const use = (name: string): ClaudeTurn => ({
	stopReason: 'tool_use',
	content: [{ type: 'tool_use', id: 't' + name, name, input: {} }]
});
const say = (text: string): ClaudeTurn => ({
	stopReason: 'end_turn',
	content: [{ type: 'text', text }]
});

describe('ProjectAssistantService', () => {
	test('answers with redacted tool output and source links', async () => {
		const log: string[] = [];
		const { model } = scripted([
			use('read'),
			say('There are 3 open issues. xoxb-1234567890-abcdef')
		]);
		const service = new ProjectAssistantService({
			config,
			model,
			tools: [tool('read', false, log)]
		});
		const answer = await service.answer({
			text: 'how many issues?',
			senderId: 'UANY',
			channelId: 'C1'
		});
		expect(log).toEqual(['read']);
		expect(answer.text).toContain('3 open issues');
		expect(answer.text).not.toContain('xoxb');
		expect(answer.text).toContain('<https://github.com/o/r/issues/1|x>');
	});
});

describe('ProjectAssistantService writes', () => {
	test('hides write tools from non-writers', async () => {
		const log: string[] = [];
		const { model, seen } = scripted([say('no')]);
		const tools = [tool('read', false, log), tool('create_github_issue', true, log)];
		await new ProjectAssistantService({ config, model, tools }).answer({
			text: 'x',
			senderId: 'UANY',
			channelId: 'C1'
		});
		expect(seen.tools[0]).toEqual(['read']);
	});

	test('a writer may write on the first turn only, never after reading untrusted data', async () => {
		const log: string[] = [];
		const tools = [tool('read', false, log), tool('create_github_issue', true, log)];
		const first = scripted([use('create_github_issue'), say('created')]);
		await new ProjectAssistantService({ config, model: first.model, tools }).answer({
			text: 'file an issue',
			senderId: 'UWRITER',
			channelId: 'C1'
		});
		expect(log).toEqual(['create_github_issue']);

		log.length = 0;
		const chained = scripted([use('read'), use('create_github_issue'), say('refused')]);
		await new ProjectAssistantService({ config, model: chained.model, tools }).answer({
			text: 'look then file',
			senderId: 'UWRITER',
			channelId: 'C1'
		});
		expect(log).toEqual(['read']);
	});

	test('a non-writer cannot reach a write tool even if the model asks', async () => {
		const log: string[] = [];
		const tools = [tool('create_github_issue', true, log)];
		const { model } = scripted([use('create_github_issue'), say('cannot')]);
		await new ProjectAssistantService({ config, model, tools }).answer({
			text: 'x',
			senderId: 'UANY',
			channelId: 'C1'
		});
		expect(log).toEqual([]);
	});
});
