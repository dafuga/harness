// @harness-uid u_p43nh5e4yc
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
