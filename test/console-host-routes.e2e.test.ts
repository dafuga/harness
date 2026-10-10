import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { sessions } from './support/consoleHost';
import {
	installAndBuild,
	pagesDev,
	slashBranch,
	syntheticHost,
	type SyntheticHost
} from './support/installedHost';
import type { LocalWorker } from './support/workers';

let target: SyntheticHost;
let worker: LocalWorker;
let browser: Browser;
let head: string;
const admin = { cookie: `session=${sessions.admin}` };
const get = (path: string, headers: Record<string, string> = {}) =>
	fetch(worker.url + path, { headers, redirect: 'manual' });
const main = (commit: string, rest: string) => `/harness/branch/main/commit/${commit}/${rest}`;
const pathOf = (page: Page) => new URL(page.url()).pathname;

beforeAll(async () => {
	target = await syntheticHost();
	await installAndBuild(target);
	worker = await pagesDev(target.host);
	browser = await chromium.launch();
	head = target.index.branches.find((branch) => branch.name === 'main')?.head ?? '';
}, 900_000);
afterAll(async () => {
	await browser?.close();
	await worker?.stop();
	await target?.dispose();
});

async function adminPage(): Promise<Page> {
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	await context.addCookies([{ name: 'session', value: sessions.admin, url: worker.url }]);
	return context.newPage();
}

test('the host redirects the root and the query form to page paths, for the administrator only', async () => {
	const root = await get('/harness', admin);
	expect([root.status, root.headers.get('location')]).toEqual([308, main(head, 'map')]);
	const legacy = await get(
		`/harness?view=history&commit=${target.commit}&unit=service.title`,
		admin
	);
	expect([legacy.status, legacy.headers.get('location')]).toEqual([
		308,
		main(target.commit, 'history/unit/service.title')
	]);
	const encoded = `/harness/branch/release/1.0%23rc/commit/${head}/map`;
	for (const path of [main(head, 'map'), encoded, `/harness/commit/${head}/growth`]) {
		expect([path, (await get(path, admin)).status]).toEqual([path, 200]);
		const strangers: Array<Record<string, string>> = [{}, { cookie: `session=${sessions.member}` }];
		for (const stranger of strangers) {
			const refused = await get(path, stranger);
			expect([path, refused.status, refused.headers.get('location')]).toEqual([path, 403, null]);
		}
	}
	const unasked = await get(`/harness?commit=${target.commit}`);
	expect([unasked.status, unasked.headers.get('location')]).toEqual([403, null]);
});

test('in a browser each branch, commit and view of the installed console is its own path', async () => {
	const page = await adminPage();
	await page.goto(`${worker.url}/harness`);
	await page.getByRole('heading', { level: 1, name: 'Harness' }).waitFor();
	expect(pathOf(page)).toBe(main(head, 'map'));
	await page.getByRole('tab', { name: 'History' }).click();
	await page.waitForURL(`**${main(head, 'history')}`);
	await page.getByRole('combobox', { name: 'Commit' }).selectOption(target.commit);
	await page.waitForURL(`**${main(target.commit, 'history')}`);
	await page.getByRole('region', { name: 'Recorded verification' }).waitFor();

	// A reload keeps the page, and back and forward return to the pages that were visited.
	await page.reload();
	await page.getByRole('region', { name: 'Recorded verification' }).waitFor();
	expect(await page.getByRole('tab', { selected: true }).innerText()).toBe('History');
	await page.goBack();
	await page.waitForURL(`**${main(head, 'history')}`);
	expect(await page.getByRole('combobox', { name: 'Commit' }).inputValue()).toBe(head);
	await page.goForward();
	await page.waitForURL(`**${main(target.commit, 'history')}`);

	await page.getByRole('combobox', { name: 'Branch' }).selectOption(slashBranch);
	await page.waitForURL(`**/harness/branch/release/1.0%23rc/commit/${head}/history`);
	await page.goto(`${worker.url}${main('0'.repeat(40), 'map')}`);
	await page.getByRole('alert').waitFor();
	expect(await page.getByRole('alert').innerText()).toContain(
		'Commit 0000000 is not in this history.'
	);
	await page.context().close();
});

test('the installed console shows recorded media and exports a record, for the administrator only', async () => {
	const stranger = await browser.newPage();
	await stranger.goto(`${worker.url}${main(target.commit, 'history')}`);
	expect(await stranger.locator('body').innerText()).toBe('Forbidden');
	await stranger.close();
	const page = await adminPage();
	await page.goto(`${worker.url}${main(target.commit, 'history')}`);
	const image = page.locator('.evidence-card:not(.audio-card) img').first();
	await image.scrollIntoViewIfNeeded();
	await expect
		.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
		.toBeGreaterThan(0);
	// The export it links to opens as a complete report with the same provenance.
	const link = page.getByRole('link', { name: 'Download this record as a portable report' });
	const href = new URL((await link.getAttribute('href')) ?? '', worker.url).href;
	const viewer = await page.context().newPage();
	await viewer.setContent(await (await page.request.get(href)).text());
	await viewer.locator('.evidence-card').first().waitFor();
	expect(await viewer.locator('.evidence-card:not(.audio-card)').count()).toBe(6);
	expect(await viewer.locator('.evidence-card').first().innerText()).toContain('Fresh capture');
	const directory = process.env.HARNESS_CAPTURE_DIR;
	if (directory) {
		await mkdir(directory, { recursive: true });
		await page.screenshot({ path: join(directory, 'installed-host-desktop.png') });
	}
	await page.context().close();
}, 120_000);
