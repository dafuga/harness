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
	await page.unrouteAll();
	await page.route(`${origin}/**`, (request) => {
		const path = new URL(request.request().url()).pathname;
		const file = join(home, path.replace(/^\/harness\/media\//, 'media/'));
		if (path === '/') return request.fulfill({ contentType: 'text/html', body: shell(home) });
		if (!existsSync(file)) return request.fulfill({ status: 404, body: 'not in the preview' });
		return request.fulfill({ contentType: types[extname(file)], body: readFileSync(file) });
	});
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

/** Visual evidence leads its overview; a component retains it above every row of tabs. */
export async function reviewVisual(
	page: Page,
	route: Pick<ExplorerLocation, 'category' | 'entity'>,
	commit: string | null,
	viewport: string
): Promise<void> {
	const mode = commit ? 'commit' : 'tip';
	await open(page, { ...route, commit });
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
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
			: ['Overview', 'Contract', 'Used In', 'Uses', 'Tests', 'History']) {
			await page.getByRole('tab', { name, exact: true }).click();
			await page.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
			});
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
