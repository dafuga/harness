import { expect, test } from 'vitest';
import { gatewayStream } from '../../src/utils/gatewayStream';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';
test('stream cancellation interrupts pending Claude work', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('thread');
	const response = gatewayStream(session, repository);
	const reader = response.body!.getReader();
	await reader.read();
	await reader.cancel();
	expect(session.controller.signal.aborted).toBe(true);
});
test('process failure produces failure and never a completion', async () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('failure');
	const response = gatewayStream(session, repository);
	session.emit?.({ type: 'error', message: 'Claude unavailable' });
	const text = await response.text();
	expect(text).toContain('response.failed');
	expect(text).not.toContain('response.completed');
});
