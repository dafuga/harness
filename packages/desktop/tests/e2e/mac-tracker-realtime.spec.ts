import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, expect, test } from '../../../../test/support/browserTest';
import type { Page } from '../../../../test/support/browserTest';
import { startMacTrackerFixture } from './support/macTrackerFixture';
import {
	electronFixtureEnvironment,
	makeTemporaryDesktopEntry,
	seedHostedPage,
	startHubSpy
} from './support/trackerOverviewPublisherFixture';

const desktopRoot = resolve(import.meta.dirname, '../..');
const samples = 30;

test.setTimeout(150_000);

const indicator = (page: Page) => page.getByRole('status', { name: 'Updates' });

/** Resolves in the page on the first frame that shows the text. */
const shows = (page: Page, text: string) =>
	page.waitForFunction((value) => document.body.innerText.includes(value), text, {
		timeout: 10_000
	});

function percentile(values: number[], share: number) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.ceil(sorted.length * share) - 1];
}

type Tracker = Awaited<ReturnType<typeof startMacTrackerFixture>>;

test('the Mac inbox shows tracker changes as they happen and recovers from an outage', async ({
	browserErrors
}) => {
	const tracker = await startMacTrackerFixture();
	const temp = await mkdtemp(join(tmpdir(), 'harness-mac-realtime-'));
	const hub = await startHubSpy();
	const app = await _electron.launch({
		executablePath: createRequire(import.meta.url)('electron') as string,
		args: [await makeTemporaryDesktopEntry(temp, desktopRoot)],
		env: { ...electronFixtureEnvironment(), HARNESS_HUB_ORIGIN: hub.origin }
	});
	try {
		await tracker.redirect(app);
		browserErrors.watch(app.context());
		const page = await seedHostedPage(app, join(temp, 'profile'), hub);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.evaluate(() => (location.pathname = '/tracker'));
		await expect(indicator(page)).toHaveText('Live', { timeout: 15_000 });
		await measureLatency(page, tracker);
		await recoverFromOutage(page, tracker);
	} finally {
		await app.close();
		await hub.close();
		await tracker.stop();
		await rm(temp, { force: true, recursive: true });
	}
});

async function measureLatency(page: Page, tracker: Tracker) {
	const latencies: number[] = [];
	for (let index = 1; index <= samples; index++) {
		const title = `Realtime decision number ${index}.`;
		const started = performance.now();
		tracker.ask(`fixturelive${index}`, title);
		await shows(page, title);
		latencies.push(performance.now() - started);
	}
	const result = {
		samples,
		p50: Math.round(percentile(latencies, 0.5)),
		p95: Math.round(percentile(latencies, 0.95)),
		max: Math.round(Math.max(...latencies))
	};
	console.log('mac tracker-change latency ms', JSON.stringify(result));
	await test.info().attach('latency.json', { body: JSON.stringify(result) });
	expect(result.p95).toBeLessThan(1000);
}

/** The open item follows an answer made elsewhere, and nothing written while down is missed. */
async function recoverFromOutage(page: Page, tracker: Tracker) {
	await page.getByRole('button', { name: /Realtime decision number 1\./ }).click();
	await expect(page.getByText('Proceed: Realtime decision number 1.')).toBeVisible();
	await tracker.post('/items/fixturelive1/answer', {
		answer: 'Answered on the phone',
		by: 'Daniel'
	});
	await expect(page.getByRole('heading', { name: 'Flag answered' })).toBeVisible({
		timeout: 1000
	});
	await tracker.cut();
	await expect(indicator(page)).toHaveText('Reconnecting');
	tracker.ask('fixtureaway', 'Asked while the link was down.');
	await page.getByRole('button', { name: /All items/ }).click();
	await expect(page.getByText('Asked while the link was down.')).toHaveCount(0);
	await tracker.restore();
	await expect(indicator(page)).toHaveText('Live', { timeout: 10_000 });
	await shows(page, 'Asked while the link was down.');
	if (process.env.TAKE_SCREENSHOT)
		await page.screenshot({ path: test.info().outputPath('mac-live.png') });
}
