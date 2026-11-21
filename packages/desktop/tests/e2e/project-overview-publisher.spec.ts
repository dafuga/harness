import { test, expect, _electron } from '../../../../test/support/browserTest';
import type { ElectronApplication } from '../../../../test/support/browserTest';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	installTrackerDouble,
	LEAK_SENTINELS,
	syntheticTrackerPayloads,
	trackerRequests,
	TRACKER_ORIGIN,
	TRACKER_URLS
} from './support/projectOverviewElectronFixture';
import {
	OTHER,
	OWNER,
	seedHostedSession,
	startHubSpy
} from './support/trackerOverviewPublisherFixture';
import type { HubSpy } from './support/trackerOverviewPublisherFixture';

/** The built desktop app: package.json main is dist/main.cjs, produced by `bun run build`. */
const desktopRoot = resolve(import.meta.dirname, '../..');
const electronBinary = createRequire(import.meta.url)('electron') as string;
/** The publisher's nominal interval is 20 s; two flights plus launch fit comfortably in this limit. */
const FLIGHT_WAIT_MS = 90_000;

test.setTimeout(180_000);

/**
 * Launches the built app with the publisher opted in and pointed at the synthetic Hub spy. The
 * owner is configured, so only the canonical owner actor may be read for or sent to.
 */
async function launchWithPublisher(temp: string, hub: HubSpy): Promise<ElectronApplication> {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined
		)
	) as Record<string, string>;
	return _electron.launch({
		executablePath: electronBinary,
		args: [desktopRoot, `--user-data-dir=${join(temp, 'profile')}`],
		env: {
			...env,
			HARNESS_HUB_ORIGIN: hub.origin,
			HARNESS_TRACKER_OVERVIEW_PUBLISH: '1',
			HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID: OWNER.id
		}
	});
}

/** Polls the spy until the predicate holds; the spec fails with the observed wire when it never does. */
async function waitForWire(hub: HubSpy, predicate: () => boolean): Promise<void> {
	const end = Date.now() + FLIGHT_WAIT_MS;
	while (!predicate()) {
		if (Date.now() > end)
			throw new Error(`Hub spy saw no matching request: ${JSON.stringify(hub.records)}`);
		await new Promise((done) => setTimeout(done, 250));
	}
}

test('the verified owner publishes the display snapshot over the real wire', async () => {
	const hub = await startHubSpy();
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-publisher-'));
	const app = await launchWithPublisher(temp, hub);
	try {
		await installTrackerDouble(app, {
			mode: 'ready',
			origin: TRACKER_ORIGIN,
			urls: TRACKER_URLS,
			payloads: syntheticTrackerPayloads(Date.now())
		});
		await seedHostedSession(app, join(temp, 'profile'), OWNER, hub.origin);
		await waitForWire(hub, () => hub.records.some((record) => record.method === 'PUT'));
		const put = hub.records.find((record) => record.method === 'PUT');
		expect(put?.path).toBe('/api/tracker-overview');
		expect(put?.bearer).toBe(OWNER.token);
		const snapshot = JSON.parse(put?.body ?? 'null') as { status?: string };
		expect(snapshot.status).toBe('ready');
		for (const sentinel of LEAK_SENTINELS) expect(put?.body ?? '').not.toContain(sentinel);
	} finally {
		await app.close();
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});

test('a signed-in non-owner is never read for and never sent to', async () => {
	const hub = await startHubSpy();
	const temp = await mkdtemp(join(tmpdir(), 'harness-overview-publisher-'));
	const app = await launchWithPublisher(temp, hub);
	try {
		await installTrackerDouble(app, {
			mode: 'ready',
			origin: TRACKER_ORIGIN,
			urls: TRACKER_URLS,
			payloads: syntheticTrackerPayloads(Date.now())
		});
		await seedHostedSession(app, join(temp, 'profile'), OTHER, hub.origin);
		await waitForWire(hub, () =>
			hub.records.some((record) => record.bearer === OTHER.token && record.method === 'GET')
		);
		const readsAfterCheck = (await trackerRequests(app)).length;
		await new Promise((done) => setTimeout(done, 2_000));
		expect(hub.records.some((record) => record.method === 'PUT')).toBe(false);
		expect((await trackerRequests(app)).length).toBe(readsAfterCheck);
	} finally {
		await app.close();
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});
