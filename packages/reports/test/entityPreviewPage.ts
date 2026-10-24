import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import type { PreviewVariant } from './entityPreviewData';
import { previewHome } from './entityPreviewSetup';
import { previewShell } from './entityPreviewShell';
import {
	reviewComponentCapture,
	reviewMeasuredSources,
	reviewFocusedScreens,
	reviewScalarMeasurements,
	reviewOverviewControls,
	reviewProfileRows
} from './entityPreviewOverview';
import { commits, ids } from './entityUnits';
import { capture, ready } from './entityPreviewCapture';
export { capture, captureRegion, ready } from './entityPreviewCapture';
// A local address is a secure context, so the page can hash the bytes of an artifact it reads.
export const origin = 'http://localhost:41739';
/** Identity of the shared card asserted by both catalog and relationship acceptance flows. */
export const moduleCard = {
	units: ['reports.component.explorer-ui-explorer-module-card'],
	marker: 'explorer-ui-explorer-module-card'
};
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
/** Opens a compiled fixture at its requested address and synthetic history variant. */
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
		await page.route(`${origin}/**`, async (request) => {
			const path = new URL(request.request().url()).pathname;
			const file = join(home, path.replace(/^\/harness\/media\//, 'media/'));
			if (path === '/' || /^\/harness\/(branch|commit)\//.test(path))
				return request.fulfill({
					contentType: 'text/html',
					body: await previewShell(home, variants.get(page))
				});
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
/** Opens an address and the verification kept apart from its examples or states. */
export async function openVerification(
	page: Page,
	route: Partial<ExplorerLocation> = {},
	variant: PreviewVariant = ''
): Promise<void> {
	await open(page, route, variant);
	const summary = page.locator('[role="tabpanel"] > details > summary');
	await summary.filter({ hasText: 'Verification details' }).first().click();
}
export const where = (page: Page): Promise<ExplorerLocation> =>
	page.evaluate(() => JSON.parse(decodeURIComponent(location.hash.slice(1))) as ExplorerLocation);
export const shown = async (page: Page, selector: string): Promise<string[]> =>
	page
		.locator(selector)
		.evaluateAll((all) => all.map((found) => (found as HTMLElement).innerText.trim()));
export const fits = (page: Page): Promise<boolean> =>
	page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Clean cards lead to the detail header, where the full verdict remains interactive. */
export async function componentVerdict(page: Page) {
	const row = page.getByRole('article', { name: 'OrderList', exact: true });
	await expect(row.locator('.hx-verdict')).toHaveCount(0);
	await row.getByRole('link', { name: 'OrderList', exact: true }).click();
	await expect(page.getByRole('heading', { level: 1, name: 'OrderList' })).toBeVisible();
	return page.locator('.ex-head').getByRole('button', { name: 'Coverage incomplete' });
}
function visualTabs(category: ExplorerLocation['category']): string[] {
	return [
		'Overview',
		category === 'pages' ? 'Models' : 'Contract',
		...(category === 'pages' ? ['APIs'] : []),
		'Used In',
		'Uses',
		...(category === 'components' ? ['Audio'] : []),
		'States',
		'History',
		'Source'
	];
}
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
	for (const name of visualTabs(route.category).filter(
		(tab) => route.category !== 'pages' || tab !== 'Used In'
	)) {
		await page.getByRole('tab', { name, exact: true }).click();
		if (name === 'Used In') await page.getByRole('tab', { name, exact: true }).press('Shift+Tab');
		await ready(page);
		await capture(page, `header-base-${route.category}-${name}-${mode}-${viewport}`);
		if (name === 'Used In') {
			const focused = page.getByRole('tab', { name: 'Contract', exact: true });
			await expect(focused).toBeFocused();
			await expect(focused).toHaveCSS('outline-style', 'none');
			await expect(focused).toHaveCSS('text-decoration-line', 'underline');
		}
		if (route.category === 'pages') {
			await expect(evidence).toHaveCount(name === 'Overview' ? 1 : 0);
			expect(await where(page)).toMatchObject(route);
			continue;
		}
		await reviewComponentCapture(page, evidence, commit);
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
	const panel = page.getByRole('tabpanel', { name: 'OrderList states', exact: true });
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
