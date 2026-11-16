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
