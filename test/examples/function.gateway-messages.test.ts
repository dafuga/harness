import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gatewayMessages } from '../../src/cli/program/codex-gateway-service/claude-query-service/gatewayMessages';

const state = 'yields-serialized-history-with-image-reference-guidance';
const request = {
	model: 'claude',
	stream: true as const,
	input: [
		{
			type: 'message',
			role: 'user',
			content: [{ type: 'input_text', text: 'Summarize this note.' }]
		}
	],
	tools: []
};

test('Yields serialized history with image reference guidance', async () => {
	const messages = [];
	for await (const message of gatewayMessages(request)) messages.push(message);
	const message = messages[0];
	const content = message.message.content;
	const blocks = typeof content === 'string' ? [] : content;
	let text = typeof content === 'string' ? content : '';
	if (blocks[0]?.type === 'text') text = blocks[0].text;
	const summary = {
		type: message.type,
		role: message.message.role,
		text,
		contentTypes: blocks.map((block) => block.type),
		parent_tool_use_id: message.parent_tool_use_id
	};
	expect(messages).toHaveLength(1);
	expect(summary).toMatchObject({
		type: 'user',
		role: 'user',
		contentTypes: ['text'],
		parent_tool_use_id: null
	});
	expect(summary.text).toContain('Image references are one-based indexes');
	recordExampleCases(
		{
			unitId: 'function.gateway-messages',
			symbol: 'gatewayMessages',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'text history becomes one SDK user message', input: request, output: summary }]
	);
});

const unsupportedAttachmentRequest = {
	...request,
	input: [
		{
		type: 'message',
			role: 'user',
			content: [{ type: 'input_video', url: 'https://example.test/clip.mp4' }]
		}
	]
};

test('Throws GatewayContentError when history contains a video attachment', () => {
	expect(() => gatewayMessages(unsupportedAttachmentRequest)).toThrow('Audio, video and file attachments are unsupported');
	const state = 'throws-gatewaycontenterror-when-history-contains-a-video-att';
	recordExampleCases(
		{
			unitId: 'function.gateway-messages',
			symbol: 'gatewayMessages',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'video attachment is rejected',
				input: { attachment: 'input_video' },
				error: 'GatewayContentError'
			}
		]
	);
});

test('Throws TypeError when prompt history contains a BigInt', async () => {
	const bigintRequest = {
		...request,
		input: [
			{
				type: 'message',
				role: 'user',
				metadata: { sequence: 1n },
				content: [{ type: 'input_text', text: 'Summarize this note.' }]
			}
		]
	};
	await expect(gatewayMessages(bigintRequest).next()).rejects.toThrow(TypeError);
	const state = 'throws-typeerror-when-prompt-history-contains-a-bigint';
	recordExampleCases(
		{
			unitId: 'function.gateway-messages',
			symbol: 'gatewayMessages',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'BigInt prevents prompt JSON serialization',
				input: { historyText: 'BigInt value 1' },
				error: 'TypeError'
			}
		]
	);
});
