// @harness-uid u_p43nh5e4yc
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexRpc } from '../../src/utils/agents-providers/codex-rpc/codexRpc';
import { createHomeProviderReader } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/homeProviderReader';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { OverviewSnapshot } from '../../../reports/src/lib/projects-sessions/project-overview/projectOverview.types';
import type { TrackerOverviewAuthority } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/TrackerOverviewPublisher.types';
import { TrackerOverviewPublisher } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/TrackerOverviewPublisher';
import { createTrackerOverviewPublisher } from '../../src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/createTrackerOverviewPublisher';
import { HostedFailureValidator } from '../../src/validators/development-tooling/HostedFailureValidator';

/** Synthetic owner credential; the token is a fixture value, never a real secret. */
const credential = {
	origin: 'https://hub.example.invalid',
	principalId: 'fixture-owner',
	token: 'fixture-token'
};
/** Typed as the full union: a declared-union const would narrow to one variant in closures. */
const ready = {
	status: 'ready',
	projects: [],
	machines: [{ name: 'fixture-computer', status: 'ok' }],
	liveSessions: 0
} as OverviewSnapshot;
const INTERVAL = 20_000;

/** A fake authority whose version, sign-in and put outcome the test controls. */
function fakeAuthority(overrides: Partial<TrackerOverviewAuthority> = {}) {
	const authority = {
		authorize: vi.fn(async () => credential),
		version: vi.fn(() => 1),
		put: vi.fn(async () => {}),
		...overrides
	};
	return authority;
}

/** Flush pending promise jobs so that awaited steps run before the next assertion. */
async function settle(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** The canonical Daniel actor the publisher is configured for; the fixture credential belongs to it. */
const OWNER_ACTOR_ID = 'fixture-owner';
/** A verified signed-in Hub actor that is not the configured owner. */
const otherActor = { ...credential, principalId: 'fixture-other-actor' };

const publisherFor = (authority: TrackerOverviewAuthority, read = async () => ready) =>
	new TrackerOverviewPublisher({
		authority,
		read,
		intervalMs: INTERVAL,
		ownerActorId: OWNER_ACTOR_ID
	});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('fails closed without a configured owner actor, even when opted in', () => {
	const authority = fakeAuthority();
	for (const ownerActorId of [undefined, '', '   ']) {
		expect(
			createTrackerOverviewPublisher({
				authority,
				env: {
					HARNESS_TRACKER_OVERVIEW_PUBLISH: '1',
					HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID: ownerActorId
				}
			})
		).toBeNull();
	}
});

test('admission: a signed-in non-owner is never read or sent to, and is not re-checked each interval', async () => {
	const read = vi.fn(async () => ready);
	const authority = fakeAuthority({ authorize: vi.fn(async () => otherActor) });
	const publisher = publisherFor(authority, read);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL * 2);
	publisher.stop();
	expect(read).not.toHaveBeenCalled();
	expect(authority.put).not.toHaveBeenCalled();
	expect(authority.authorize).toHaveBeenCalledTimes(1);
});

test('re-entry: an owner who signs in after a non-owner publishes without a restart', async () => {
	let active: typeof credential = otherActor;
	let version = 1;
	const authority = fakeAuthority({
		authorize: vi.fn(async () => active),
		version: () => version
	});
	const publisher = publisherFor(authority);
	publisher.start();
	await settle();
	active = credential;
	version = 2;
	await vi.advanceTimersByTimeAsync(INTERVAL);
	publisher.stop();
	expect(authority.put).toHaveBeenCalledTimes(1);
	expect(authority.put).toHaveBeenLastCalledWith(credential, JSON.stringify(ready));
});

test('the owner publisher rereads session rules on each flight and works with older Tracker nodes', async () => {
	const authority = fakeAuthority();
	const rule = {
		at: '2026-11-28T12:00:00.000Z',
		incident: 'fixture123',
		skill: 'computer-hygiene',
		text: 'Close the browser fixture after testing.'
	};
	let currentRules = [rule];
	let supportsRules = true;
	const loopback = vi.fn(async (url: string) => {
		if (url === 'http://127.0.0.1:7701/rules?limit=5')
			return supportsRules ? Response.json(currentRules) : new Response(null, { status: 404 });
		return Response.json([]);
	});
	vi.stubGlobal('fetch', loopback);
	const publisher = createTrackerOverviewPublisher({
		authority,
		env: {
			HARNESS_TRACKER_OVERVIEW_PUBLISH: '1',
			HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID: OWNER_ACTOR_ID
		}
	})!;
	const overview = { ...ready, machines: [] };
	try {
		publisher.start();
		await publisher.tick();
		expect(authority.put).toHaveBeenLastCalledWith(
			credential,
			JSON.stringify({ ...overview, sessionRules: currentRules })
		);
		currentRules = [{ ...rule, text: 'Keep the fixture open until the capture finishes.' }];
		await vi.advanceTimersByTimeAsync(INTERVAL);
		await publisher.tick();
		expect(authority.put).toHaveBeenLastCalledWith(
			credential,
			JSON.stringify({ ...overview, sessionRules: currentRules })
		);
		supportsRules = false;
		await vi.advanceTimersByTimeAsync(INTERVAL);
		await publisher.tick();
		expect(authority.put).toHaveBeenLastCalledWith(credential, JSON.stringify(overview));
	} finally {
		publisher.stop();
		vi.unstubAllGlobals();
	}
});

test('re-entry: a refused owner publishes again only after a new connection, without a restart', async () => {
	let version = 1;
	const put = vi
		.fn<TrackerOverviewAuthority['put']>()
		.mockRejectedValueOnce(new HostedFailureValidator('denied', 403))
		.mockResolvedValue(undefined);
	const authority = fakeAuthority({ put, version: () => version });
	const publisher = publisherFor(authority);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL);
	expect(put).toHaveBeenCalledTimes(1);
	version = 2;
	await vi.advanceTimersByTimeAsync(INTERVAL);
	publisher.stop();
	expect(put).toHaveBeenCalledTimes(2);
});

vi.mock('../../src/utils/agents-providers/codex-rpc/codexRpc', () => ({
	codexRpc: vi.fn(async () => {
		throw new Error('Unexpected live provider lookup');
	})
}));

test('the owner snapshot validates both subscriptions and routine freshness without a live lookup', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'hub-home-provider-'));
	try {
		const file = join(dir, 'providers.json');
		const read = createHomeProviderReader(file);
		const now = Date.parse('2026-11-22T08:00:00Z');
		const readAt = new Date(now).toISOString();
		const quota = (['claude', 'codex'] as const).map((provider) => ({
			id: provider,
			provider,
			readAt,
			plan: null,
			account: null,
			limits: [{ id: 'weekly', label: 'Weekly', left: 17, resetsAt: null }],
			credits: null,
			history: [],
			agents: []
		}));
		const snapshot = { routinesReadAt: readAt, routines: [], quota };
		expect(await read(now)).toEqual({ routines: null, quota: null });
		await writeFile(file, JSON.stringify(snapshot));
		expect(await read(now + 300_000)).toEqual(snapshot);
		await writeFile(
			file,
			JSON.stringify({ ...snapshot, quota: [{ ...quota[0], readAt: 'invalid' }] })
		);
		expect(await read(now + 600_000)).toEqual({ routines: null, quota: null });
		expect(codexRpc).not.toHaveBeenCalled();
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
