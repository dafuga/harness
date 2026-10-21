import { chromium, type Browser, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { browserErrorCollector } from './support/browserTest';
import {
	browserRun,
	atTeardown,
	eventually,
	runPassed,
	seededHistories,
	serving,
	type BrowserRun
} from './support/browserRun';
import { openRunGate, type RunGate } from './support/runGate';

/**
 * A page that one browser run has open while another run starts beside it in the same checkout,
 * as a verification does next to a suite that is already going. The reader chose something on
 * that page. Nothing outside the run may load the page again: what was chosen is still shown.
 * This is the start of the second run's servers seen from a page of the first, at the moment it
 * happens, and not left to the chance of when two runs that start together reach it.
 */
let scratch: string;
let browser: Browser;
let browserErrors: ReturnType<typeof browserErrorCollector>;
beforeEach(() => {
	browserErrors = browserErrorCollector();
});
afterEach(async () => {
	await browserErrors.finish();
});
const runs: BrowserRun[] = [];
const gates: RunGate[] = [];
const quick = ['tests/e2e/harness-cache.spec.ts'];
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/** The build a server says it serves; a run serves its own copy of the compiled build. */
const built = async (url: string) =>
	((await (await fetch(`${url}/api/health`)).json()) as { buildId?: string }).buildId;

/**
 * The supported state the reader opened at a selected commit and viewport. Both the viewport
 * selection and the open viewer live on the page alone, so a reload would lose that choice.
 */
async function chosen(page: Page) {
	const viewer = page.getByRole('dialog', { name: 'filled · After', exact: true });
	const viewport = viewer.getByRole('group', { name: 'Viewport' });
	const shot = viewer.locator('img');
	return {
		state: await viewer.getByRole('heading', { level: 2 }).innerText(),
		viewport: await viewport.locator('[aria-pressed="true"]').innerText(),
		file: await shot.evaluate((image: HTMLImageElement) => image.src.split('/').pop() ?? ''),
		drawn: await shot.evaluate((image: HTMLImageElement) => image.naturalWidth > 0)
	};
}

beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'harness-run-pages-'));
	browser = await chromium.launch();
}, 60_000);
afterAll(async () => {
	await browser?.close();
	await Promise.all(gates.map((gate) => gate.close()));
	await Promise.all(runs.map((run) => run.stop()));
	await rm(scratch, { recursive: true, force: true });
}, 120_000);

test('a page one run has open keeps what was opened on it when another run starts its servers', async () => {
	// The first run goes on, and so do its servers, until this test has seen what it came for.
	const firstGate = await openRunGate(scratch, 'first');
	gates.push(firstGate);
	const first = await browserRun('first', scratch, quick, { repeat: 1, gate: firstGate.path });
	runs.push(first);
	let over = false;
	void first.finished.then(() => (over = true));
	await serving(first.url);
	await atTeardown(first, firstGate, 'first');
	const [history] = await eventually(() => {
		const found = seededHistories(scratch);
		return found.length === 1 ? found : undefined;
	}, 'the first run to seed its history');

	const page = await browser.newPage();
	browserErrors.watch(page.context());
	const { branch, commits } = history;
	const address = `/harness/branch/${encodeURIComponent(branch)}/commit/${commits.twin}`;
	await page.goto(`${first.url}${address}/pages/${history.page}?tab=states`);
	const evidence = page.getByRole('region', { name: /supported states$/ });
	await evidence.getByRole('combobox', { name: 'Viewport' }).selectOption('mobile');
	await evidence.getByRole('button', { name: 'Open filled · After', exact: true }).click();
	const before = await eventually(async () => {
		const now = await chosen(page);
		return now.state === 'filled · After' && now.viewport === 'Mobile screenshots' && now.drawn
			? now
			: undefined;
	}, 'the chosen state and viewport to be drawn');
	// The capture is served under the name of its own content, by the build the run started from.
	const media = `${first.url}/harness/media/${before.file}`;
	const bytes = async () => Buffer.from(await (await page.request.get(media)).body());
	expect(`${sha256(await bytes())}.png`).toBe(before.file);
	const frozen = await built(first.url);
	expect(typeof frozen).toBe('string');
	let loads = 0;
	page.on('load', () => (loads += 1));

	// The second run goes on as well, so its server is still there to be asked what it serves.
	const secondGate = await openRunGate(scratch, 'second');
	gates.push(secondGate);
	const second = await browserRun('second', scratch, quick, { repeat: 1, gate: secondGate.path });
	runs.push(second);
	await serving(second.url);
	await atTeardown(second, secondGate, 'second');
	// A reload is sent the moment the other server writes its files; this is time for it to land.
	await eventually(() => (loads > 0 ? loads : undefined), 'a reload', 5).catch(() => 0);

	// The first run was still going, so its page could have been told to load again. A run that
	// had ended would have shown nothing: it says why it ended instead.
	if (over) await runPassed(first, 'first');
	expect(over).toBe(false);
	expect(loads).toBe(0);
	// What was chosen is still chosen and still drawn, from the same bytes of the same build; the
	// second run serves a copy of that build over a history of its own.
	expect(await chosen(page)).toEqual(before);
	expect(`${sha256(await bytes())}.png`).toBe(before.file);
	expect([await built(first.url), await built(second.url)]).toEqual([frozen, frozen]);
	const other = seededHistories(scratch).find((found) => found.home !== history.home);
	expect(other?.commits.twin).not.toBe(commits.twin);
	const foreign = await fetch(`${second.url}/harness/data/revisions/${commits.twin}.json`);
	expect(foreign.status).toBe(404);
	firstGate.release();
	secondGate.release();
	await Promise.all([runPassed(first, 'first'), runPassed(second, 'second')]);
}, 900_000);
