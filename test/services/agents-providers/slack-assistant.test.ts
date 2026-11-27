import { expect, test, vi } from 'vitest';
import type {
	PlatformEvent,
	PlatformEventHandler
} from '../../../src/core/agents-providers/platformAdapter.types';
import { SlackAssistantService } from '../../../src/services/agents-providers/SlackAssistantService';

const mention = {
	id: 'EvOne',
	channelId: 'CQA',
	senderId: 'UWRITER',
	text: '<@UBOT> Is staging up?',
	messageId: '1.000001'
};
const dm = {
	id: 'EvTwo',
	channelId: 'DDIRECT',
	senderId: 'UWRITER',
	text: 'Create a GitHub issue for a broken logo',
	messageId: '2.000001',
	threadId: '2.000000'
};

test('SlackAssistantService accepts events before model work completes and replies in the same threads', async () => {
	let release!: () => void;
	const ready = new Promise<void>((resolve) => {
		release = resolve;
	});
	const answer = vi.fn(async () => {
		await ready;
		return { text: 'Healthy <!channel> xoxb-1234567890-secret', sources: [], toolCalls: [] };
	});
	const send = vi.fn(async () => ({
		status: 'sent' as const,
		requestId: 'req',
		auditRecorded: true,
		receipt: { channelId: 'CQA', messageId: '3.000001' }
	}));
	const subscribe = async (reply: PlatformEventHandler, signal: AbortSignal) => {
		await reply(mention, signal);
		await reply(dm, signal);
		expect(send).not.toHaveBeenCalled();
		release();
	};
	await new SlackAssistantService({
		slack: { subscribe, send },
		assistant: { answer },
		botUserId: 'UBOT',
		report: vi.fn()
	}).run(new AbortController().signal);
	expect(answer.mock.calls).toEqual([
		[{ text: 'Is staging up?', senderId: 'UWRITER', channelId: 'CQA', allowWrite: false }],
		[{ text: dm.text, senderId: 'UWRITER', channelId: 'DDIRECT', allowWrite: true }]
	]);
	expect(send.mock.calls).toEqual(
		[mention, dm].map((event: PlatformEvent) => [
			{
				channelId: event.channelId,
				threadId: event.threadId ?? event.messageId,
				text: 'Healthy &lt;!channel> [redacted]'
			}
		])
	);
});
