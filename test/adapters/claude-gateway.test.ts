import { expect, test } from 'vitest';
import { ClaudeGatewayAdapter } from '../../src/adapters/ClaudeGatewayAdapter';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';
test('incomplete continuation cannot unblock pending tool execution', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('thread');
	session.running = true;
	const pending = repository.waitForTool(session, 'call');
	expect(() =>
		new ClaudeGatewayAdapter(repository).start(
			{ model: 'claude-opus-5-5', stream: true, input: [], tools: [] },
			session
		)
	).toThrow('pending tool results');
	const rejection = expect(pending).rejects.toThrow('cancelled');
	repository.cancel(session);
	await rejection;
});

test('process restart cannot recreate an unowned tool continuation', () => {
	const repository = new CodexSessionRepository();
	const adapter = new ClaudeGatewayAdapter(repository);
	expect(() =>
		adapter.start(
			{
				model: 'claude-opus-5-5',
				stream: true,
				tools: [],
				input: [{ type: 'function_call_output', call_id: 'lost', output: 'already executed' }]
			},
			repository.create('after-restart')
		)
	).toThrow('No active query');
});

test('complete history correlates output without counting the earlier call twice', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('history');
	session.running = true;
	const pending = repository.waitForTool(session, 'call-history');
	new ClaudeGatewayAdapter(repository).start(
		{
			model: 'claude-opus-5-5',
			stream: true,
			tools: [],
			input: [
				{ type: 'function_call', call_id: 'call-history' },
				{ type: 'function_call_output', call_id: 'call-history', output: 'marker' }
			]
		},
		session
	);
	expect(await pending).toBe('marker');
});
