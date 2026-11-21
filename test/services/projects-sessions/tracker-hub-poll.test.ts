import { afterEach, test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { measureWorkload } from '../../support/measureWorkload';
import {
	expectJson,
	hubFixture,
	operation,
	pullPage,
	signedRequest,
	unit
} from './trackerHubFixture';

afterEach(() => vi.useRealTimers());

const pull = { method: 'GET', path: '/sync/pull?since=0&wait=25' } as const;

test('a committed push wakes concurrent long polls through a single journal subscription', async () => {
	await measureWorkload(unit, 'signed-push-wakes-two-pulls', async () => {
		const { send, store, listeners } = hubFixture();
		const waiting = [send(pull), send(pull)];
		expect(listeners.size).toBe(1);
		expect(store.subscribe).toHaveBeenCalledTimes(1);
		await expectJson(
			await send({
				method: 'POST',
				path: '/sync/push',
				text: JSON.stringify({ ops: [operation] })
			}),
			200,
			{ ok: true, applied: 1, db_id: 'fixture-db', last: 1 }
		);
		for (const response of await Promise.all(waiting))
			await expectJson(response, 200, pullPage([{ ...operation, seq: 1 }], 1, 1));
		expect(listeners.size).toBe(0);
	});
});

test('long-poll timeout caps the requested wait at 60 seconds and releases the journal subscription', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	const { send, listeners } = hubFixture();
	const pending = send({ ...pull, path: '/sync/pull?wait=120' });
	await vi.advanceTimersByTimeAsync(59_999);
	expect(listeners.size).toBe(1);
	await vi.advanceTimersByTimeAsync(1);
	await expectJson(await pending, 200, pullPage([], 0, 0));
	expect(listeners.size).toBe(0);
	expect(vi.getTimerCount()).toBe(0);
});

test('canceling one poll leaves others subscribed, and canceling the last avoids a journal reread', async () => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
	const { hub, store, listeners } = hubFixture();
	const clients = [new AbortController(), new AbortController()];
	const waiting = clients.map(({ signal }) => hub.handle({ ...signedRequest(pull), signal }));
	const [first, last] = clients;
	first.abort();
	await expect(waiting[0]).rejects.toBe(first.signal.reason);
	expect(listeners.size).toBe(1);
	expect(vi.getTimerCount()).toBe(1);
	last.abort();
	await expect(waiting[1]).rejects.toBe(last.signal.reason);
	expect(listeners.size).toBe(0);
	expect(vi.getTimerCount()).toBe(0);
	expect(store.opsSince).toHaveBeenCalledTimes(2);
});
