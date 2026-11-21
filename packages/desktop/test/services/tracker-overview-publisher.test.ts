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
const unavailable = { status: 'unavailable' } as OverviewSnapshot;
const INTERVAL = 20_000;
/** A deferred read or put that the test resolves by hand. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	return { promise: new Promise<T>((done) => (resolve = done)), resolve };
}

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

const publisherFor = (authority: TrackerOverviewAuthority, read = async () => ready) =>
	new TrackerOverviewPublisher({
		authority,
		read,
		intervalMs: INTERVAL,
		ownerActorId: OWNER_ACTOR_ID
	});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('without a verified connection nothing is read or published', async () => {
	const read = vi.fn(async () => ready);
	const authority = fakeAuthority({
		authorize: vi.fn(async () => {
			throw new Error('A verified hosted session is required.');
		})
	});
	const publisher = publisherFor(authority, read);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL * 3);
	publisher.stop();
	expect(read).not.toHaveBeenCalled();
	expect(authority.put).not.toHaveBeenCalled();
});

test('a connected owner publishes the display snapshot on start and every interval', async () => {
	const authority = fakeAuthority();
	const publisher = publisherFor(authority);
	publisher.start();
	await settle();
	expect(authority.put).toHaveBeenCalledTimes(1);
	expect(authority.put).toHaveBeenLastCalledWith(credential, JSON.stringify(ready));
	await vi.advanceTimersByTimeAsync(INTERVAL);
	expect(authority.put).toHaveBeenCalledTimes(2);
	publisher.stop();
});

test('an unavailable tracker is published as the explicit unavailable snapshot', async () => {
	const authority = fakeAuthority();
	const publisher = publisherFor(authority, async () => unavailable);
	publisher.start();
	await settle();
	expect(authority.put).toHaveBeenLastCalledWith(credential, JSON.stringify(unavailable));
	publisher.stop();
});

test('a read that throws publishes unavailable and never reuses an earlier snapshot', async () => {
	const authority = fakeAuthority();
	const read = vi
		.fn<() => Promise<OverviewSnapshot>>()
		.mockResolvedValueOnce(ready)
		.mockRejectedValueOnce(new Error('tracker crashed'));
	const publisher = publisherFor(authority, read);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL);
	expect(authority.put).toHaveBeenNthCalledWith(2, credential, JSON.stringify(unavailable));
	publisher.stop();
});

test('a refused owner stops publishing, and no later flight writes', async () => {
	const authority = fakeAuthority({
		put: vi.fn(async () => {
			throw new HostedFailureValidator('denied', 403);
		})
	});
	const publisher = publisherFor(authority);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL * 3);
	expect(authority.put).toHaveBeenCalledTimes(1);
	expect(authority.authorize).toHaveBeenCalledTimes(1);
});

test('a failure that is not a refusal only skips that flight', async () => {
	const put = vi
		.fn<TrackerOverviewAuthority['put']>()
		.mockRejectedValueOnce(new HostedFailureValidator('offline'))
		.mockResolvedValue(undefined);
	const authority = fakeAuthority({ put });
	const publisher = publisherFor(authority);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL);
	expect(put).toHaveBeenCalledTimes(2);
	publisher.stop();
});

test('stop before a read completes discards the result and writes nothing', async () => {
	const read = deferred<OverviewSnapshot>();
	const authority = fakeAuthority();
	const publisher = publisherFor(authority, () => read.promise);
	publisher.start();
	await settle();
	publisher.stop();
	read.resolve(ready);
	await settle();
	expect(authority.put).not.toHaveBeenCalled();
});

test('an account change during a read discards that flight', async () => {
	const read = deferred<OverviewSnapshot>();
	let version = 1;
	const authority = fakeAuthority({ version: () => version });
	const publisher = publisherFor(authority, () => read.promise);
	publisher.start();
	await settle();
	version = 2;
	read.resolve(ready);
	await settle();
	expect(authority.put).not.toHaveBeenCalled();
	publisher.stop();
});

test('a flight still in progress blocks the next interval from overlapping it', async () => {
	const put = deferred<void>();
	const authority = fakeAuthority({ put: vi.fn(() => put.promise) });
	const publisher = publisherFor(authority);
	publisher.start();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL * 2);
	expect(authority.put).toHaveBeenCalledTimes(1);
	put.resolve();
	await settle();
	await vi.advanceTimersByTimeAsync(INTERVAL);
	expect(authority.put).toHaveBeenCalledTimes(2);
	publisher.stop();
});

test('stop ends the interval and a second start is a no-op until the next start', async () => {
	const authority = fakeAuthority();
	const publisher = publisherFor(authority);
	publisher.start();
	publisher.start();
	await settle();
	expect(authority.put).toHaveBeenCalledTimes(1);
	publisher.stop();
	await vi.advanceTimersByTimeAsync(INTERVAL * 2);
	expect(authority.put).toHaveBeenCalledTimes(1);
	await publisher.tick();
	expect(authority.put).toHaveBeenCalledTimes(1);
	publisher.start();
	await settle();
	expect(authority.put).toHaveBeenCalledTimes(2);
	publisher.stop();
});

test('is opt-in: nothing is created unless HARNESS_TRACKER_OVERVIEW_PUBLISH is 1', () => {
	const authority = fakeAuthority();
	const owner = { HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID: OWNER_ACTOR_ID };
	expect(createTrackerOverviewPublisher({ authority, env: owner })).toBeNull();
	expect(
		createTrackerOverviewPublisher({
			authority,
			env: { ...owner, HARNESS_TRACKER_OVERVIEW_PUBLISH: '0' }
		})
	).toBeNull();
	expect(
		createTrackerOverviewPublisher({
			authority,
			env: { ...owner, HARNESS_TRACKER_OVERVIEW_PUBLISH: '1' }
		})
	).toBeInstanceOf(TrackerOverviewPublisher);
});

test('no verified Hub connection means no publisher even when opted in', () => {
	expect(
		createTrackerOverviewPublisher({ env: { HARNESS_TRACKER_OVERVIEW_PUBLISH: '1' } })
	).toBeNull();
});
