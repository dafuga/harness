import { describe, expect, test } from 'vitest';
import type {
	HomeAgent,
	HomeChatInput
} from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import { agentOpenAsks } from '../../../reports/src/lib/projects-sessions/hub-home/homeOpenAsks';
import { deliverHomeChat } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeTrackerChat';

const options = [
	{ label: 'Ship it', effect: 'Merges the change.', recommended: true as const },
	{ label: 'Wait', effect: 'Holds until tomorrow.' }
];
const agent = (extra: Partial<HomeAgent> = {}): HomeAgent => ({
	id: 'project',
	name: 'Project',
	state: 'needs-you',
	sessions: 0,
	tasks: [],
	subAgents: { sessions: 0, tasks: [] },
	itemId: 'item1',
	task: 'Synthetic task',
	machine: null,
	model: null,
	since: '2026-11-25T10:00:00.000Z',
	question: 'Ship it?',
	options,
	messages: [],
	...extra
});
const tap = (extra: Partial<HomeChatInput> = {}): HomeChatInput => ({
	id: 'chat-1',
	agentId: 'project',
	itemId: 'item1',
	kind: 'answer',
	question: 'Ship it?',
	text: 'Ship it',
	option: 1,
	...extra
});

/** The home a Mac publishes for one asking agent: the agent and its listed ask. */
const homeOf = (extra: Partial<HomeAgent> = {}) => {
	const agents = [agent(extra)];
	return { agents, openAsks: agentOpenAsks(agents) };
};

function recorder(status = 200) {
	const calls: { url: string; body: unknown }[] = [];
	const fetcher = (async (url: string, init: RequestInit) => {
		calls.push({ url, body: JSON.parse(String(init.body)) });
		return new Response(null, { status });
	}) as unknown as typeof fetch;
	return { calls, fetcher };
}

describe('a Hub option tap reaches the tracker as one structured answer', () => {
	test('records the option number, by Daniel via Hub', async () => {
		const { calls, fetcher } = recorder();
		const receipt = await deliverHomeChat(tap(), homeOf(), fetcher);
		expect(receipt.status).toBe('sent');
		expect(calls).toEqual([
			{
				url: 'http://127.0.0.1:7701/items/item1/answer',
				body: { option: 1, confirmed: false, by: 'Daniel via Hub' }
			}
		]);
	});

	test('refuses a tap that is not an option of the open ask', async () => {
		const { calls, fetcher } = recorder();
		for (const input of [tap({ option: 3 }), tap({ text: 'Other label' })])
			expect((await deliverHomeChat(input, homeOf(), fetcher)).status).toBe('refused');
		expect(calls).toEqual([]);
	});

	test('a deploy, money or secret ask needs the confirm step', async () => {
		const { calls, fetcher } = recorder();
		const risky = homeOf({ confirm: 'deploy' });
		expect((await deliverHomeChat(tap(), risky, fetcher)).status).toBe('refused');
		expect((await deliverHomeChat(tap({ confirmed: true }), risky, fetcher)).status).toBe('sent');
		expect(calls.map((call) => call.body)).toEqual([
			{ option: 1, confirmed: true, by: 'Daniel via Hub' }
		]);
	});

	test('free-text answers still go as text', async () => {
		const { calls, fetcher } = recorder();
		await deliverHomeChat(tap({ option: undefined, text: 'Do it Friday' }), homeOf(), fetcher);
		expect(calls[0].body).toEqual({ answer: 'Do it Friday', by: 'Daniel via Hub' });
		await deliverHomeChat(
			tap({ option: 2, text: 'Wait' }),
			homeOf({
				task: '[QA automation] Hub canary'
			}),
			fetcher
		);
		expect(calls[1].body).toEqual({ option: 2, confirmed: false, by: 'QA automation via Hub' });
	});
});
