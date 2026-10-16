import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { alpha, colors, gamma, type OptionId } from './ui-design-options-fixture';
import { evidenced } from './ui-design-options-evidence';

/** Addresses, reads and captures shared by the design-option specs. */
export const at = (rest: string, project = alpha) =>
	`/projects/${project}/harness/branch/${project === gamma ? 'main' : 'feat%2Falpha'}/${rest}`;
export const activity = 'pages/page%3Aactivity/designs';
export const optionGroup = (page: Page) => page.getByRole('group', { name: 'Design option' });
export const option = (page: Page, n: number) =>
	optionGroup(page).getByRole('button', { name: `Option ${n}`, exact: true });
export const count = (scope: Page | Locator) =>
	scope.getByRole('combobox', { name: 'Design options', exact: true });
export const modes = (page: Page) => page.getByRole('group', { name: 'Request mode' });

/** The bridge calls of one operation, in order. */
export async function calls(page: Page, op: string): Promise<Record<string, unknown>[]> {
	const all = await page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls);
	return (all as Record<string, unknown>[]).filter((call) => call.op === op);
}

/** The colour of the centre pixel of the shown design image, read from its decoded pixels. */
export async function shownColor(page: Page, version = 'v003'): Promise<number[]> {
	const image = page.getByRole('img', { name: new RegExp(`\\b${version}\\b`) }).first();
	await expect(image).toBeVisible();
	return image.evaluate(async (node: HTMLImageElement) => {
		await node.decode();
		const canvas = document.createElement('canvas');
		[canvas.width, canvas.height] = [node.naturalWidth, node.naturalHeight];
		const context = canvas.getContext('2d')!;
		context.drawImage(node, 0, 0);
		const [x, y] = [Math.floor(node.naturalWidth / 2), Math.floor(node.naturalHeight / 2)];
		return Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
	});
}
export const shows = (page: Page, id: OptionId) =>
	expect.poll(() => shownColor(page)).toEqual([...colors[id]]);

/**
 * A screenshot at a checkpoint that the checks after it own, kept only when TAKE_SCREENSHOT is
 * true: labelled before or after by SCREENSHOT_LABEL, outside the source tree. A before capture
 * shows the interface as it is, without the controls the checks then ask for.
 */
export async function remember(page: Page, info: TestInfo, name: string) {
	await page.evaluate(async () => {
		const shown = [...document.images].filter(
			(image) => (image.currentSrc || image.src) && image.getClientRects().length > 0
		);
		await Promise.all(shown.map((image) => image.decode()));
		await document.fonts.ready;
	});
	await evidenced(page, name);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.DESIGN_OPTION_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	const label = `${process.env.SCREENSHOT_LABEL ?? 'run'}-${name}-${page.viewportSize()?.width}`;
	await page.screenshot({
		path: join(folder, `${label}.png`),
		fullPage: true,
		animations: 'disabled'
	});
}
