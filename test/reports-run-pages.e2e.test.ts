import { chromium, type Browser } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	browserRun,
	eventually,
	runPassed,
	seededHistories,
	serving,
	type BrowserRun
} from './support/browserRun';

/**
 * A page that one browser run has open while another run starts beside it in the same checkout,
 * as a verification does next to a suite that is already going. The reader opened something on
 * that page. Nothing outside the run may load the page again: what was opened is still open.
 * This is the start of the second run's servers seen from a page of the first, at the moment it
 * happens, and not left to the chance of when two runs that start together reach it.
 */
let scratch: string;
let browser: Browser;
const runs: BrowserRun[] = [];
const quick = ['tests/e2e/harness-legacy.spec.ts'];
/** Enough repetitions to outlast the start of any second run; the first is stopped long before. */
const held = 300;

beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'harness-run-pages-'));
	browser = await chromium.launch();
}, 60_000);
afterAll(async () => {
	await browser?.close();
	await Promise.all(runs.map((run) => run.stop()));
	await rm(scratch, { recursive: true, force: true });
}, 120_000);

test('a page one run has open keeps what was opened on it when another run starts its servers', async () => {
	// The first run goes on, and so do its servers, until this test has seen what it came for.
	const first = await browserRun('first', scratch, quick, held);
	runs.push(first);
	let over = false;
	void first.finished.then(() => (over = true));
	await serving(first.url);
	const [history] = await eventually(() => {
		const found = seededHistories(scratch);
		return found.length === 1 ? found : undefined;
	}, 'the first run to seed its history');

	const page = await browser.newPage();
	await page.goto(`${first.url}/harness?view=history&commit=${history.commits.reordered}`);
	const earlier = page.getByRole('region', { name: 'Earlier reports' });
	const linked = earlier.getByRole('listitem').filter({ hasText: 'Uppercase titles' });
	await linked.getByRole('button', { name: 'Show its evidence' }).click();
	const card = earlier.locator('.evidence-card');
	await card.waitFor();
	let loads = 0;
	page.on('load', () => (loads += 1));

	const second = await browserRun('second', scratch, quick);
	runs.push(second);
	await serving(second.url);
	// A reload is sent the moment the other server writes its files; this is time for it to land.
	await eventually(() => (loads > 0 ? loads : undefined), 'a reload', 5).catch(() => 0);

	// The first run was still going, so its page could have been told to load again. A run that
	// had ended would have shown nothing: it says why it ended instead.
	if (over) await runPassed(first, 'first');
	expect(over).toBe(false);
	expect(loads).toBe(0);
	expect(await card.count()).toBe(1);
	expect(await linked.getByRole('button', { name: 'Hide its evidence' }).count()).toBe(1);
}, 900_000);
