import { expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** The widths every surface with a select is looked at. */
export const screens = [
	['desktop', 1440, 1000],
	['tablet', 920, 800],
	['mobile', 390, 844]
] as const;

/** Keeps a picture of the page at a checkpoint, only for a run that asks for pictures. */
export async function pictured(page: Page, name: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = join('output/evidence', process.env.SCREENSHOT_LABEL || 'current');
	await mkdir(folder, { recursive: true });
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await page.screenshot({ path: join(folder, `${name}.png`), animations: 'disabled' });
}

/**
 * What the shared select gives a field on every surface: its caret, set in from the end and
 * centred, room for a finger, and text that stops before the caret starts.
 */
export async function sharedField(field: Locator): Promise<void> {
	await field.scrollIntoViewIfNeeded();
	const caret = field.locator('..').locator('svg[aria-hidden="true"]');
	await expect(caret, 'the field has the caret of the shared select').toBeVisible();
	const box = (await field.boundingBox())!;
	const icon = (await caret.boundingBox())!;
	const inset = box.x + box.width - icon.x - icon.width;
	expect(inset).toBeGreaterThanOrEqual(12);
	expect(inset).toBeLessThanOrEqual(20);
	expect(Math.abs(icon.y + icon.height / 2 - box.y - box.height / 2)).toBeLessThan(1);
	expect(box.height).toBeGreaterThanOrEqual(44);
	const padding = await field.evaluate((element) =>
		parseFloat(getComputedStyle(element).paddingInlineEnd)
	);
	expect(padding, 'the chosen text ends before the caret starts').toBeGreaterThanOrEqual(
		inset + icon.width
	);
}

/** Chooses by typing into the field, as a keyboard does: no pointer and no opened list. */
export async function typed(page: Page, field: Locator, text: string): Promise<void> {
	await field.focus();
	await expect(field).toBeFocused();
	await page.keyboard.type(text);
}

/** Whether the page is as wide as the screen and no wider. */
export const fits = (page: Page): Promise<boolean> =>
	page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
