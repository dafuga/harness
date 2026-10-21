import { expect, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import type { PreviewVariant } from './entityPreviewData';
import { previewHome } from './entityPreviewSetup';
import {
	reviewMeasuredSources,
	reviewFocusedScreens,
	reviewScalarMeasurements,
	reviewOverviewControls,
	reviewProfileRows
} from './entityPreviewOverview';
import { commits, ids } from './entityUnits';
import { capture, ready } from './entityPreviewCapture';
export { capture, ready } from './entityPreviewCapture';
// A local address is a secure context, so the page can hash the bytes of an artifact it reads.
export const origin = 'http://localhost:41739';
export const viewports = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 834, height: 1112 },
	mobile: { width: 390, height: 844 }
};
const served = new WeakSet<Page>();
const variants = new WeakMap<Page, PreviewVariant>();
const types: Record<string, string> = {
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.wav': 'audio/wav',
	'.json': 'application/json'
};
function shell(home: string, variant: PreviewVariant = ''): string {
	const sheets = readdirSync(home).filter((name) => name.endsWith('.css'));
	const hashes = readFileSync(join(home, 'hashes.json'), 'utf8');
	const links = sheets.map((name) => `<link rel="stylesheet" href="/${name}">`).join('');
	return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${links}</head>
<body><div class="hx-shell"><main class="hx-main" id="app"></main></div>
<script>window.artifactHashes=${hashes};window.previewVariant=${JSON.stringify(variant)}</script><script src="/preview.iife.js"></script></body></html>`;
}
/**
 * Opens the content at an address, served from the built preview and from nowhere else. A
 * variant asks for the selected commit with a state uncaptured or with reasons at old length.
 */
export async function open(
	page: Page,
	route: Partial<ExplorerLocation> = {},
	variant: PreviewVariant = ''
): Promise<void> {
	const home = previewHome();
	variants.set(page, variant);
	// Keep asset routes installed while this page switches views, including pending lazy reads.
	await page.goto('about:blank');
	if (!served.has(page)) {
		await page.route(`${origin}/**`, (request) => {
			const path = new URL(request.request().url()).pathname;
			const file = join(home, path.replace(/^\/harness\/media\//, 'media/'));
			if (path === '/' || /^\/harness\/(branch|commit)\//.test(path))
				return request.fulfill({ contentType: 'text/html', body: shell(home, variants.get(page)) });
			if (!existsSync(file)) return request.fulfill({ status: 404, body: 'not in the preview' });
			return request.fulfill({ contentType: types[extname(file)], body: readFileSync(file) });
		});
		served.add(page);
	}
	const address = { branch: 'feature/orders', commit: null, category: 'pages', ...route };
	const asked = variant ? `?variant=${variant}` : '';
	await page.goto(`${origin}/${asked}#${encodeURIComponent(JSON.stringify(address))}`);
	await page.locator('.ex-content').waitFor();
}
/** The address the content is at, as the preview keeps it. */
export const where = (page: Page): Promise<ExplorerLocation> =>
	page.evaluate(() => JSON.parse(decodeURIComponent(location.hash.slice(1))) as ExplorerLocation);
/** What a locator shows as text, as a person reads it: nothing hidden, each space once. */
export const shown = async (page: Page, selector: string): Promise<string[]> =>
	page
		.locator(selector)
		.evaluateAll((all) => all.map((found) => (found as HTMLElement).innerText.trim()));
/** True when nothing makes the page wider than its window. */
export const fits = (page: Page): Promise<boolean> =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Visual evidence leads its overview; a component retains it above every row of tabs. */
export async function reviewVisual(
	page: Page,
	route: Pick<ExplorerLocation, 'category' | 'entity'>,
	commit: string | null,
	viewport: string
): Promise<void> {
	const mode = commit ? 'commit' : 'tip';
	await open(page, { ...route, commit });
	await ready(page);
	await capture(page, `overview-${route.category}-${mode}-${viewport}`);
	const title = commit ? 'Commit comparison' : 'Current screenshot';
	const evidence = page.getByRole('heading', { name: title, exact: true });
	const profile = page.getByRole('region', { name: 'Performance profile', exact: true });
	expect((await evidence.boundingBox())!.y).toBeLessThan((await profile.boundingBox())!.y);
	expect(await fits(page)).toBe(true);
	await reviewOverviewControls(page, route.category);
	const tabs = ['Overview', 'Contract', 'Used In', 'Uses', 'States', 'History', 'Source'];
	for (const name of tabs.filter((tab) => route.category !== 'pages' || tab !== 'Used In')) {
		await page.getByRole('tab', { name, exact: true }).click();
		await ready(page);
		await capture(page, `header-base-${route.category}-${name}-${mode}-${viewport}`);
		if (route.category === 'pages') {
			await expect(evidence).toHaveCount(name === 'Overview' ? 1 : 0);
			expect(await where(page)).toMatchObject(route);
			continue;
		}
		await expect(evidence, 'component screenshot persists across tabs').toHaveCount(1);
		const tabs = await page.getByRole('tablist').boundingBox();
		const shot = await page.locator('section[aria-labelledby="ex-screens-title"]').boundingBox();
		expect(shot!.y + shot!.height, 'component screenshot stays above its tabs').toBeLessThanOrEqual(
			tabs!.y
		);
		const files = await page
			.locator('section[aria-labelledby="ex-screens-title"] img')
			.evaluateAll((images) => images.map((image) => image.getAttribute('src')));
		expect(files).toEqual(
			commit
				? ['/media/aaaaaaa-default-desktop.png', '/media/bbbbbbb-default-desktop.png']
				: ['/media/ccccccc-default-desktop.png']
		);
		expect(await fits(page)).toBe(true);
	}
}
/** Every supported visual state has its own revision-bound picture, including errors. */
export async function reviewStates(
	page: Page,
	route: Pick<ExplorerLocation, 'category' | 'entity'>,
	commit: string | null,
	viewport: string
): Promise<void> {
	await open(page, { ...route, commit }, 'states');
	await ready(page);
	await capture(page, `states-entry-${commit ? 'commit' : 'tip'}-${viewport}`);
	const states = page.getByRole('tab', { name: 'States', exact: true });
	await expect(states, 'visual entities expose a States tab').toHaveCount(1);
	await expect(page.getByRole('tab', { name: 'Tests', exact: true })).toHaveCount(0);
	await states.click();
	const panel = page.getByRole('tabpanel', { name: 'Order list states', exact: true });
	await expect(panel).toBeVisible();
	expect(await where(page)).toMatchObject({ ...route, commit, tab: 'states' });
	for (const state of ['Default', 'Empty', 'Error']) {
		const card = panel.getByRole('article', { name: state, exact: true });
		await expect(card).toBeVisible();
		const images = card.getByRole('img');
		await expect(images).toHaveCount(commit ? 2 : 1);
		const revisions = commit ? ['aaaaaaa', 'bbbbbbb'] : ['ccccccc'];
		expect(
			await images.evaluateAll((all) => all.map((image) => image.getAttribute('src')))
		).toEqual(revisions.map((at) => `/media/${at}-${state.toLowerCase()}-desktop.png`));
		for (const image of await images.all()) {
			await image.scrollIntoViewIfNeeded();
			await image.evaluate((node: HTMLImageElement) => node.decode());
		}
	}
	await capture(page, `states-gallery-${commit ? 'commit' : 'tip'}-${viewport}`);
	await panel.getByRole('combobox', { name: 'Viewport', exact: true }).selectOption('mobile');
	await expect(
		panel.getByRole('article', { name: 'Error', exact: true }).getByRole('img').last()
	).toHaveAttribute('src', `/media/${commit ? 'bbbbbbb' : 'ccccccc'}-error-mobile.png`);
	expect(await fits(page)).toBe(true);
}
/** Choose through the same filter dialog used by every catalog, retaining keyboard focus. */
export async function chooseCatalogFilter(page: Page, name: string, value: string | boolean) {
	await page.getByRole('button', { name: 'Filters', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Filters', exact: true });
	if (typeof value === 'boolean') await dialog.getByLabel(name, { exact: true }).setChecked(value);
	else await dialog.getByRole('combobox', { name, exact: true }).selectOption(value);
	await dialog.getByRole('button', { name: 'Done', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeFocused();
}

export async function reviewMeasurements(tab: Page, name: string): Promise<void> {
	const performance = tab.getByRole('region', { name: 'Performance profile' });
	await capture(tab, `automatic-measurements-${name}`);
	await expect(performance).toContainText('0.12 ms');
	await expect(performance).not.toContainText('No performance budget');

	await reviewScalarMeasurements(tab);
	expect(await fits(tab)).toBe(true);
	await open(tab, { category: 'services', entity: ids.store, commit: commits.middle });
	await ready(tab);
	await capture(tab, `measurements-service-${name}`);
	const profile = tab.getByRole('region', { name: 'Performance profile', exact: true });
	await expect(profile).toContainText('Emitted size · Wasm');
	await expect(profile).toContainText('18 KB');
	await expect(profile).toContainText('no toolchain');
	await reviewProfileRows(tab);
	await reviewMeasuredSources(tab, async (route) => {
		await open(tab, { ...route, commit: commits.middle }, 'measurements');
		await ready(tab);
		await capture(tab, `measurements-current-${route.category}-${name}`);
	});
	await reviewFocusedScreens(
		tab,
		name,
		() => open(tab, { category: 'pages', entity: ids.page, commit: commits.middle }, 'focused'),
		async (name) => {
			await ready(tab);
			await capture(tab, name);
		}
	);
}
