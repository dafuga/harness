import { expect } from '../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { ConsoleBridgeAdapter } from '../src/adapters/ConsoleBridgeAdapter';
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});
test('a tab retries an unacknowledged start with its original request identity and context', async () => {
	vi.useFakeTimers();
	const starts: Record<string, unknown>[] = [];
	let count = 0;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url, init) => {
			const body = JSON.parse(init.body);
			if (body.method === 'connect') return Response.json({ token: 'fixture', snapshot: {} });
			if (body.method === 'events') return Response.json({ events: [], sequence: 0 });
			if (body.method === 'startRun') {
				starts.push(body);
				if (++count === 1) throw new TypeError('Lost response');
				return Response.json({ runId: 'run' });
			}
			return Response.json(null);
		})
	);
	const adapter = new ConsoleBridgeAdapter(),
		bridge = adapter.bridge();
	const input = { intent: 'task', text: 'Explain', branch: 'main', commit: 'a', conversation: [] };
	await expect(bridge.startRun(input as never)).rejects.toThrow('Lost response');
	await expect(bridge.startRun({ ...input, text: 'Different' } as never)).rejects.toThrow(
		/previous request/
	);
	await expect(
		bridge.startRun({
			...input,
			commit: 'b',
			conversation: [{ author: 'user', text: 'Extra' }]
		} as never)
	).resolves.toEqual({ runId: 'run' });
	expect(starts).toHaveLength(2);
	expect(starts[1]).toEqual(starts[0]);
	adapter.close();
});
test('closing a connecting tab disconnects its late session rather than retaining an orphan', async () => {
	let resolve!: (response: Response) => void;
	const calls: Record<string, unknown>[] = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (_url, init) => {
			const body = JSON.parse(init.body);
			calls.push(body);
			return body.method === 'connect'
				? await new Promise<Response>((done) => (resolve = done))
				: Response.json(null);
		})
	);
	const adapter = new ConsoleBridgeAdapter(),
		connecting = adapter.connect();
	adapter.close();
	resolve(Response.json({ token: 'late-fixture', snapshot: {} }));
	await expect(connecting).rejects.toThrow(/closed/);
	expect(calls).toContainEqual(
		expect.objectContaining({ method: 'disconnect', token: 'late-fixture' })
	);
});
