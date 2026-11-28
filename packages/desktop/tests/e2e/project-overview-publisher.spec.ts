import { test, expect, _electron } from '../../../../test/support/browserTest';
import type { ElectronApplication } from '../../../../test/support/browserTest';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';
import {
	installTrackerDouble,
	LEAK_SENTINELS,
	syntheticTrackerPayloads,
	trackerRequests,
	TRACKER_ORIGIN,
	TRACKER_URLS
} from './support/projectOverviewElectronFixture';
import {
	makeTemporaryDesktopEntry,
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
		args: [await makeTemporaryDesktopEntry(temp, desktopRoot)],
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
			throw new Error(`Hub spy saw no matching request among ${hub.records.length} requests.`);
		await new Promise((done) => setTimeout(done, 250));
	}
}

/** Shows the same display projection after the genuine main-process publish is observed. */
async function capturePublishedOverview(app: ElectronApplication) {
	const size = { width: 1440, height: 900 };
	await app.evaluate(({ BrowserWindow }, viewport) => {
		BrowserWindow.getAllWindows()[0].setContentSize(viewport.width, viewport.height);
	}, size);
	const page = await app.firstWindow();
	await page.evaluate(() => window.dispatchEvent(new Event('focus')));
	await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
	await expect(page.getByText('fixture-needs', { exact: true }).first()).toBeVisible({
		timeout: 25_000
	});
	if (!evidenceRequested()) return page;
	await expect.poll(() => page.evaluate(() => innerWidth)).toBe(size.width);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
		);
	});
	const buildId = buildStamp(
		(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
	);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!buildId || !revision)
		throw new Error('The publisher capture needs a stamped native renderer.');
	recordCapture(
		{
			evidence: 'publisher-screen',
			kind: 'screenshot',
			state: 'publish',
			viewport: 'desktop',
			file: 'publisher-overview-desktop.png',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision }
		},
		await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' })
	);
	return page;
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
		const page = await capturePublishedOverview(app);
		await expect
			.poll(
				() =>
					hub.records.some(
						(record) =>
							record.method === 'GET' &&
							record.bearer === OWNER.token &&
							record.path === '/api/tracker-overview'
					),
				{ timeout: 25_000 }
			)
			.toBe(true);
		hub.denyOverviewReads();
		await page.evaluate(() => window.dispatchEvent(new Event('focus')));
		await expect(page.getByText('fixture-needs', { exact: true })).toHaveCount(0, {
			timeout: 25_000
		});
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
		await new Promise((done) => setTimeout(done, 2_000));
		expect(hub.records.some((record) => record.method === 'PUT')).toBe(false);
		await expectNoPublisherReads(app);
		const page = await app.firstWindow();
		await page.getByRole('link', { name: 'Project Overview', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('The tracker could not be reached', {
			timeout: 25_000
		});
		expect(
			hub.records.some(
				(record) =>
					record.method === 'GET' &&
					record.bearer === OTHER.token &&
					record.path === '/api/tracker-overview'
			)
		).toBe(true);
		await expectNoPublisherReads(app);
	} finally {
		await app.close();
		await hub.close();
		await rm(temp, { recursive: true, force: true });
	}
});

async function expectNoPublisherReads(app: ElectronApplication) {
	// Home also reads Tracker, but its runs request includes include_active=1.
	const reads = await trackerRequests(app);
	expect(reads.filter(({ url }) => url === TRACKER_URLS.runs)).toEqual([]);
}
