import { expect, test, vi } from 'vitest';
import { GatewayEventsService } from '../../src/services/GatewayEventsService';
import { CodexSessionRepository } from '../../src/repositories/CodexSessionRepository';
test('parallel bridge calls close their response batch only once', async () => {
	vi.useFakeTimers();
	try {
		const session = new CodexSessionRepository().create('thread');
		session.emit = vi.fn();
		const events = new GatewayEventsService();
		events.finishToolBatch(session);
		events.finishToolBatch(session);
		await vi.runAllTimersAsync();
		expect(session.emit).toHaveBeenCalledTimes(1);
	} finally {
		vi.useRealTimers();
	}
});
