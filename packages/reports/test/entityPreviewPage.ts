import { expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import type { PreviewVariant } from './entityPreviewData';
import { previewHome } from './entityPreviewSetup';

// A local address is a secure context, so the page can hash the bytes of an artifact it reads.
export const origin = 'http://localhost:41739';
export const viewports = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 834, height: 1112 },
	mobile: { width: 390, height: 844 }
};
const served = new WeakSet<Page>();
const types: Record<string, string> = {
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.wav': 'audio/wav',
	'.json': 'application/json'
};

function shell(home: string): string {
	const sheets = readdirSync(home).filter((name) => name.endsWith('.css'));
	const hashes = readFileSync(join(home, 'hashes.json'), 'utf8');
	const links = sheets.map((name) => `<link rel="stylesheet" href="/${name}">`).join('');
	return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${links}</head>
<body><div class="hx-shell"><main class="hx-main" id="app"></main></div>
<script>window.artifactHashes=${hashes}</script><script src="/preview.iife.js"></script></body></html>`;
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
	// Keep asset routes installed while this page switches views, including pending lazy reads.
	await page.goto('about:blank');
	if (!served.has(page)) {
		await page.route(`${origin}/**`, (request) => {
			const path = new URL(request.request().url()).pathname;
			const file = join(home, path.replace(/^\/harness\/media\//, 'media/'));
			if (path === '/') return request.fulfill({ contentType: 'text/html', body: shell(home) });
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

/** Keeps what the page shows, when a run asks for screenshots; the name says what and how wide. */
export async function capture(page: Page, name: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== '1') return;
	const directory = process.env.ENTITY_PREVIEW_SHOTS ?? '/tmp/harness-entity-preview-shots';
	mkdirSync(directory, { recursive: true });
	await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

/** Wait for the visible capture to render without forcing offscreen lazy images to load. */
async function ready(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		const visible = [...document.images].filter((image) => {
			const box = image.getBoundingClientRect();
			return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
		});
		await Promise.all(visible.map((image) => image.decode()));
	});
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
	const size = page.getByRole('region', { name: 'Size', exact: true });
	expect((await evidence.boundingBox())!.y).toBeLessThan((await size.boundingBox())!.y);
	expect(await fits(page)).toBe(true);
	if (route.category !== 'components') return;
	for (const details of [false, true]) {
		if (details) await page.getByRole('link', { name: 'Details', exact: true }).click();
		for (const name of details
			? ['Contract', 'Measurements', 'Source', 'History']
			: ['Overview', 'Contract', 'Used In', 'Uses', 'States', 'History']) {
			await page.getByRole('tab', { name, exact: true }).click();
			await ready(page);
			await capture(page, `header-${details ? 'details' : 'base'}-${name}-${mode}-${viewport}`);
			await expect(evidence, 'component screenshot persists across tabs').toHaveCount(1);
			const tabs = await page.getByRole('tablist').boundingBox();
			const shot = await page.locator('section[aria-labelledby="ex-screens-title"]').boundingBox();
			expect(
				shot!.y + shot!.height,
				'component screenshot stays above its tabs'
			).toBeLessThanOrEqual(tabs!.y);
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
