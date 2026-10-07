import { expect, test, vi } from 'vitest';
import { CodexSessionRepository } from '../src/repositories/CodexSessionRepository';
import { CodexGatewayService } from '../src/services/CodexGatewayService';
const runs = vi.hoisted(() => ({ count: 0 }));
vi.mock('../src/services/ClaudeQueryService', () => ({
	ClaudeQueryService: class {
		run(_request: unknown, session: { emit: (event: unknown) => void }) {
			runs.count++;
			session.emit({ type: 'text', text: 'reply' });
			session.emit({ type: 'done' });
		}
	}
}));
test('identical retry replays the original stream without another query', async () => {
	const service = new CodexGatewayService({ token: 'synthetic' });
	const request = () =>
		new globalThis.Request('http://localhost/v1/responses', {
			method: 'POST',
			headers: { authorization: 'Bearer synthetic', 'thread-id': 'retry' },
			body: JSON.stringify({ model: 'claude-opus-5-5', stream: true, input: [] })
		});
	const first = await (await service.fetch(request())).text();
	const second = await (await service.fetch(request())).text();
	expect(second).toBe(first);
	expect(runs.count).toBe(1);
});
test('cancelled session cannot be recreated and repeat ambiguous tool work', () => {
	const repository = new CodexSessionRepository();
	const session = repository.create('cancelled');
	repository.cancel(session);
	expect(() => repository.create('cancelled')).toThrow('cancelled');
});
