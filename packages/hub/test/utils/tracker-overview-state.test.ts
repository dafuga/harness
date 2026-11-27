// @harness-uid u_6vq2h9nzd1
import { afterEach, expect, test, vi } from 'vitest';
import { liveReadMs } from '../../src/lib/networking-security/hubLiveUpdates';
import {
	overviewPath,
	readOverview,
	watchWhileVisible
} from '../../src/routes/tracker-overview/overviewClient';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

/** A window and document that keep one listener per event type, so the watch runs without a browser. */
function browserStub() {
	const listeners = new Map<string, () => void>();
	const add = (type: string, listener: () => void) => listeners.set(type, listener);
	const remove = (type: string) => listeners.delete(type);
	vi.stubGlobal('window', { addEventListener: add, removeEventListener: remove });
	vi.stubGlobal('document', {
		visibilityState: 'visible',
		addEventListener: add,
		removeEventListener: remove
	});
	return listeners;
}

/** A synthetic ready snapshot with one project and one computer. No real tracker text. */
const ready = {
	status: 'ready',
	projects: [
		{
			agent: 'synthetic-project',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 1, in_progress: 0, blocked: 0, done: 0 },
			items: [],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T10:00:00.000Z'
		}
	],
	machines: [{ name: 'synthetic-computer', status: 'ok' }],
	liveSessions: 0
};

/** A fetch that answers once with the given status and JSON body, and records the request. */
function answering(status: number, body: unknown) {
	const calls: { url: string; init: RequestInit | undefined }[] = [];
	const fetcher = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	}) as typeof fetch;
	return { fetcher, calls };
}

test('the owner read sends one same-origin GET with no store and no credential', async () => {
	const { fetcher, calls } = answering(200, ready);
	const outcome = await readOverview(fetcher);
	expect(outcome).toEqual({ kind: 'owner', snapshot: ready });
	expect(calls).toHaveLength(1);
	expect(calls[0].url).toBe(overviewPath);
	expect(calls[0].url).not.toContain('?');
	expect(calls[0].init).toMatchObject({
		method: 'GET',
		credentials: 'same-origin',
		cache: 'no-store'
	});
	expect(calls[0].init?.body).toBeUndefined();
});

test('an unavailable owner answer (503) still means the account is the owner', async () => {
	const { fetcher } = answering(503, { status: 'unavailable' });
	expect(await readOverview(fetcher)).toEqual({
		kind: 'owner',
		snapshot: { status: 'unavailable' }
	});
});

test.each([401, 403, 404])(
	'a refusal with status %i shows nothing and carries no data',
	async (status) => {
		const { fetcher } = answering(status, { error: 'refused', projects: ready.projects });
		expect(await readOverview(fetcher)).toEqual({ kind: 'denied' });
	}
);

test('an unexpected status is a failed read, not an owner answer', async () => {
	const { fetcher } = answering(500, ready);
	expect(await readOverview(fetcher)).toEqual({ kind: 'failed' });
});

test('a network failure is a failed read and holds no earlier snapshot', async () => {
	const fetcher = (async () => {
		throw new TypeError('network down');
	}) as typeof fetch;
	expect(await readOverview(fetcher)).toEqual({ kind: 'failed' });
});

test('a malformed ready body reads as unavailable, never as projects', async () => {
	const malformed = { status: 'ready', projects: 'not-a-list', machines: [], liveSessions: 0 };
	const { fetcher } = answering(200, malformed);
	expect(await readOverview(fetcher)).toEqual({
		kind: 'owner',
		snapshot: { status: 'unavailable' }
	});
});

test('a body that is not JSON reads as unavailable', async () => {
	const fetcher = (async () => new Response('<html>proxy</html>', { status: 200 })) as typeof fetch;
	expect(await readOverview(fetcher)).toEqual({
		kind: 'owner',
		snapshot: { status: 'unavailable' }
	});
});

test('a visible page refreshes at most every 20 seconds and stops when told', () => {
	vi.useFakeTimers();
	const listeners = browserStub();
	const refresh = vi.fn();
	const stop = watchWhileVisible(refresh);
	vi.advanceTimersByTime(20_000);
	expect(refresh).toHaveBeenCalledTimes(1);
	expect(liveReadMs, 'Hub Home allows a full read on the first visible turn').toBe(20_000);
	listeners.get('focus')?.();
	expect(refresh).toHaveBeenCalledTimes(1);
	vi.advanceTimersByTime(20_000);
	expect(refresh).toHaveBeenCalledTimes(2);
	stop();
	vi.advanceTimersByTime(60_000);
	expect(refresh).toHaveBeenCalledTimes(2);
	expect(listeners.size).toBe(0);
});
