import { expect, test } from 'vitest';
import { gatewayMessages } from '../../src/utils/gatewayMessages';

test('SDK receives one user envelope containing ordered role-labelled history', async () => {
	const input = [
		{ role: 'user', content: 'remember marker' },
		{ role: 'assistant', content: 'marker' }
	];
	const messages = [];
	for await (const message of gatewayMessages({
		model: 'claude-opus-5-5',
		stream: true,
		tools: [],
		input
	}))
		messages.push(message);
	expect(messages).toHaveLength(1);
	expect(messages[0]).toMatchObject({
		type: 'user',
		parent_tool_use_id: null,
		message: { role: 'user' }
	});
	expect(JSON.stringify(messages[0].message.content)).toContain('remember marker');
});
