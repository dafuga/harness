import { expect, test } from 'vitest';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';

test('pending tool results are isolated and cannot be delivered twice', async () => {
	const repository = new CodexSessionRepository();
	const first = repository.create('thread-a');
	const second = repository.create('thread-b');
	const output = repository.waitForTool(first, 'call-a');
	expect(() =>
		repository.deliver(second, [
			{ type: 'function_call_output', call_id: 'call-a', output: 'wrong' }
		])
	).toThrow();
	repository.deliver(first, [
		{ type: 'function_call_output', call_id: 'call-a', output: 'correct' }
	]);
	expect(await output).toBe('correct');
	expect(() =>
		repository.deliver(first, [
			{ type: 'function_call_output', call_id: 'call-a', output: 'duplicate' }
		])
	).toThrow();
});

test('cancelling a session rejects pending work without executing tools', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('cancelled-thread');
	const pending = repository.waitForTool(session, 'pending-call');
	const assertion = expect(pending).rejects.toThrow('cancelled');
	repository.cancel(session);
	await assertion;
	expect(session.controller.signal.aborted).toBe(true);
});
