import { chromium, type Browser, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { browserErrorCollector } from './support/browserTest';
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
let browserErrors: ReturnType<typeof browserErrorCollector>;
beforeEach(() => {
	browserErrors = browserErrorCollector();
});
afterEach(async () => {
	await browserErrors.finish();
});
const admin = { cookie: `session=${sessions.admin}` };
const get = (path: string, headers: Record<string, string> = {}) =>
	fetch(worker.url + path, { headers, redirect: 'manual' });
const main = (commit: string, rest: string) => `/harness/branch/main/commit/${commit}/${rest}`;
const tip = (rest: string) => `/harness/branch/main/${rest}`;
/** The whole branch is one segment of an explorer address. */
const slashed = `/harness/branch/${encodeURIComponent(slashBranch)}`;
const categories = 'Pages,Modules,Styles,Configs,Translations,Platforms'.split(',');
const pathOf = (page: Page) => new URL(page.url()).pathname;
const bar = (page: Page) => page.getByRole('banner');
const field = (page: Page, name: string) => bar(page).getByRole('combobox', { name, exact: true });
/** A commit of the main branch other than its tip, so choosing it is a change of address. */
const earlier = () =>
	target.index.revisions.map((revision) => revision.commit).find((commit) => commit !== head) ?? '';
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
	browserErrors.watch(context);
	await context.addCookies([{ name: 'session', value: sessions.admin, url: worker.url }]);
	return context.newPage();
}
test('the host redirects the root and the query form to page paths, for the administrator only', async () => {
	const root = await get('/harness', admin);
	expect([root.status, root.headers.get('location')]).toEqual([308, tip('pages')]);
	const legacy = await get(
		`/harness?view=history&commit=${target.commit}&unit=service.title`,
		admin
	);
	expect([legacy.status, legacy.headers.get('location')]).toEqual([
		308,
		main(target.commit, 'services/service.title/history')
	]);
	// Pages of the explorer, and page paths of the earlier console, which the console leads on.
	const explorer = [
		tip('pages'),
		main(head, 'functions'),
		`${slashed}/pages`,
		tip('layouts'),
		main(head, 'layouts'),
		tip('shells'),
		tip('types'),
		main(head, 'types'),
		`${slashed}/types`,
		main(head, 'shells')
	];
	const before = [main(head, 'map'), `/harness/branch/release/1.0%23rc/commit/${head}/map`];
	for (const path of [...explorer, ...before, `/harness/commit/${head}/growth`]) {
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

test('in a browser each branch, commit and category of the installed console is its own path', async () => {
	const page = await adminPage();
	const [commit, other] = [field(page, 'Commit'), earlier()];
	expect(other).not.toBe('');
	await page.goto(`${worker.url}/harness`);
	await page.getByRole('heading', { level: 1, name: 'Pages' }).waitFor();
	expect(pathOf(page)).toBe(tip('pages'));
	const controls = bar(page)
		.getByRole('navigation', { name: 'Harness categories' })
		.locator('a, button');
	expect(await controls.allInnerTexts()).toEqual(categories);
	expect(await page.getByRole('link', { name: /Reports|Analytics|Activity|Growth/ }).count()).toBe(
		0
	);
	await bar(page).getByRole('button', { name: 'Modules', exact: true }).click();
	const modules = bar(page).getByRole('navigation', { name: 'Module categories' });
	await modules.getByRole('link', { name: 'Layouts', exact: true }).click();
	await page.waitForURL(`**${tip('layouts')}`);
	await page.getByRole('heading', { level: 1, name: 'Layouts' }).waitFor();
	expect(await commit.inputValue()).toBe(head);
	await bar(page).getByRole('button', { name: 'Modules', exact: true }).click();
	await modules.getByRole('link', { name: 'Helpers', exact: true }).click();
	await page.waitForURL(`**${tip('functions')}`);
	expect(await commit.inputValue()).toBe(head);
	await commit.selectOption(other);
	await page.waitForURL(`**${main(other, 'functions')}`);
	await page.getByRole('heading', { level: 1, name: 'Helpers' }).waitFor();

	// A reload keeps the page, and back and forward return to the pages that were visited.
	await page.reload();
	await page.getByRole('heading', { level: 1, name: 'Helpers' }).waitFor();
	expect(await commit.inputValue()).toBe(other);
	await page.goBack();
	await page.waitForURL(`**${tip('functions')}`);
	expect(await commit.inputValue()).toBe(head);
	await page.goForward();
	await page.waitForURL(`**${main(other, 'functions')}`);
	await bar(page).getByRole('link', { name: 'Go to tip' }).click();
	await page.waitForURL(`**${tip('functions')}`);

	await field(page, 'Branch').selectOption(slashBranch);
	await page.waitForURL(`**${slashed}/functions`);
	// The tab of a section is part of the address: a reload of the installed console keeps it.
	const source = `${main(target.commit, 'pages/page.titles')}?tab=source`;
	await page.goto(worker.url + `${main(target.commit, 'pages/page.titles/details')}?tab=source`);
	await page.getByRole('tab', { name: 'Source', selected: true }).waitFor();
	await page.reload();
	await page.getByRole('tab', { name: 'Source', selected: true }).waitFor();
	expect(pathOf(page) + new URL(page.url()).search).toBe(source);
	// A page path of the earlier console is led to the page of the explorer it stands for.
	await page.goto(`${worker.url}${main(head, 'map')}`);
	await page.waitForURL(`**${main(head, 'pages')}`);
	await page.goto(`${worker.url}${main('0'.repeat(40), 'pages')}`);
	await page.getByRole('alert').waitFor();
	expect(await page.getByRole('alert').innerText()).toContain(
		'Commit 0000000 is not in this history.'
	);
	await page.context().close();
});

test('the installed console shows recorded media and exports a record, for the administrator only', async () => {
	const entity = main(target.commit, 'pages/page.titles');
	const stranger = await browser.newPage();
	browserErrors.watch(stranger.context());
	browserErrors.expectError({
		type: 'console',
		message: 'Failed to load resource: the server responded with a status of 403 (Forbidden)',
		source: worker.url + entity,
		reason: 'An unauthenticated browser deliberately proves access is refused.'
	});
	await stranger.goto(worker.url + entity);
	expect(await stranger.locator('body').innerText()).toBe('Forbidden');
	await stranger.close();
	const page = await adminPage();
	await page.goto(worker.url + entity);
	// A selected commit shows what was captured of the page at that commit.
	const image = page.getByRole('region', { name: 'Commit comparison' }).locator('img').first();
	await image.scrollIntoViewIfNeeded();
	await expect
		.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
		.toBeGreaterThan(0);
	// The export its tests link to opens as a complete report with the same provenance.
	await page.goto(`${worker.url}${entity}?tab=tests`);
	await page.getByText('Verification details', { exact: true }).click();
	const link = page.getByRole('link', { name: 'Download this record' }).first();
	const address = new URL((await link.getAttribute('href')) ?? '', worker.url);
	expect(address.pathname).toBe(`/harness/export/${target.commit}`);
	const viewer = await page.context().newPage();
	await viewer.setContent(await (await page.request.get(address.href)).text());
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

test('the installed console names the repository of its recorded history, to the administrator only', async () => {
	const data = '/harness/data/activity.json';
	const member = { cookie: `session=${sessions.member}` };
	expect([(await get(data)).status, (await get(data, member)).status]).toEqual([403, 403]);
	const answered = await get(data, admin);
	expect(answered.status).toBe(200);
	const recorded = (await answered.json()) as {
		kind: string;
		repository: { head: string; name: string };
	};
	expect([recorded.kind, recorded.repository.head]).toEqual(['recorded', head]);
	const page = await adminPage();
	// The earlier activity address leads to Pages with the current category navigation.
	await page.goto(worker.url + main(head, 'activity'));
	await page.waitForURL(`**${main(head, 'pages')}`);
	await bar(page).getByText(recorded.repository.name, { exact: true }).waitFor();
	const controls = bar(page)
		.getByRole('navigation', { name: 'Harness categories' })
		.locator('a, button');
	expect(await controls.allInnerTexts()).toEqual(categories);
	// Nothing in the installed console asks for agents: a host has no checkout to read them from.
	expect(await page.getByRole('tab', { name: 'Activity' }).count()).toBe(0);
	expect(await page.getByTestId('agents-working').count()).toBe(0);
	await page.context().close();
});
