import { expect } from '../../../../test/verificationExpect';
import { afterEach, test, vi } from 'vitest';
import { AgentHttpAdapter } from '../../src/adapters/AgentHttpAdapter';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';
import type { RunEvent } from '../../src/models/DesktopBridge.types';

const denied = () => Object.assign(new Error('Denied'), { status: 403 });
const request = { intent: 'task', text: 'Inspect project', branch: 'main', commit: 'a' };
function adapter(send: ConstructorParameters<typeof AgentHttpAdapter>[0]) {
	const result = new AgentHttpAdapter(send);
	result.shown(
		{
			project: { id: 'project' },
			writable: true,
			capabilities: { agents: true },
			revision: { branch: 'main', commit: 'a', atTip: true }
		} as ProjectSnapshot,
		{ branch: 'main', commit: null }
	);
	return result;
}
afterEach(() => vi.useRealTimers());

test('an uncertain start keeps its identity through unrelated errors and retries its original payload', async () => {
	vi.useFakeTimers();
	const send = vi
		.fn()
		.mockRejectedValueOnce(new TypeError('Network lost'))
		.mockRejectedValueOnce(Object.assign(new Error('Bad approval'), { status: 400 }))
		.mockResolvedValueOnce({ runId: 'run' });
	const client = adapter(send);
	await expect(client.call('startRun', request, 'project')).rejects.toThrow('Network lost');
	const original = structuredClone(send.mock.calls[0][1]);
	await expect(client.call('approve', {}, 'project')).rejects.toThrow('Bad approval');
	await expect(
		client.call('startRun', { ...request, text: 'Different request' }, 'project')
	).rejects.toThrow('previous request');
	expect(send).toHaveBeenCalledTimes(2);
	await client.call(
		'startRun',
		{
			...request,
			branch: 'other',
			commit: 'b',
			conversation: [{ author: 'user', text: 'New context' }]
		},
		'project'
	);
	expect(send.mock.calls[2][1]).toEqual(original);
	expect(original.requestId).toEqual(expect.any(String));
});

test('temporary polling failure retains the run until its confirmed terminal event', async () => {
	vi.useFakeTimers();
	const send = vi
		.fn()
		.mockResolvedValueOnce({ runId: 'run' })
		.mockRejectedValueOnce(new TypeError('Offline'))
		.mockResolvedValueOnce({
			events: [{ sequence: 1, value: { runId: 'run', kind: 'text', text: 'Answer' } }]
		})
		.mockResolvedValueOnce({
			events: [
				{ sequence: 2, value: { runId: 'run', kind: 'finished', summary: 'Done', verified: false } }
			]
		});
	const client = adapter(send),
		events: RunEvent[] = [];
	client.listen((event) => events.push(event));
	await client.call('startRun', request, 'project');
	await vi.advanceTimersByTimeAsync(0);
	expect(events.some((event) => event.kind === 'failed')).toBe(false);
	expect(events.at(-1)).toMatchObject({ kind: 'status', runId: 'run' });
	await vi.advanceTimersByTimeAsync(700);
	expect(events.at(-1)).toMatchObject({ kind: 'finished', runId: 'run' });
	expect(send.mock.calls[3][1]).toEqual({ method: 'events', input: { runId: 'run', after: 1 } });
	await vi.advanceTimersByTimeAsync(2000);
	expect(send).toHaveBeenCalledTimes(4);
});

test('a definitive polling denial stops the run subscription', async () => {
	vi.useFakeTimers();
	const send = vi.fn().mockResolvedValueOnce({ runId: 'run' }).mockRejectedValueOnce(denied());
	const client = adapter(send),
		events: RunEvent[] = [];
	client.listen((event) => events.push(event));
	await client.call('startRun', request, 'project');
	await vi.advanceTimersByTimeAsync(2000);
	expect(events).toEqual([expect.objectContaining({ kind: 'failed', runId: 'run' })]);
	expect(send).toHaveBeenCalledTimes(2);
});
