import { expect, test } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

for (const width of [1440, 920, 390]) {
	test(`gallery status caret is comfortably inset and selection filters at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 1000 });
		const id = (await readFile('/tmp/project-reports-e2e/fixture-id', 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		const filter = page.getByRole('combobox', { name: 'Status', exact: true });
		await filter.scrollIntoViewIfNeeded();
		await page.evaluate(async () => {
			await document.fonts.ready;
			for (const image of document.images) {
				const box = image.getBoundingClientRect();
				if (box.width && box.height && box.top < innerHeight && box.bottom > 0) {
					await image.decode();
					if (!image.complete || !image.naturalWidth) throw new Error('Image not ready');
				}
			}
		});
		if (process.env.TAKE_SCREENSHOT === 'true') {
			const folder = join('output/evidence', process.env.SCREENSHOT_LABEL || 'current');
			await mkdir(folder, { recursive: true });
			await page.screenshot({ path: join(folder, `gallery-select-${width}.png`) });
		}
		const caret = filter.locator('..').locator('svg[aria-hidden="true"]');
		await expect(caret, 'The status field has a visible inset caret').toBeVisible();
		const field = (await filter.boundingBox())!;
		const icon = (await caret.boundingBox())!;
		const inset = field.x + field.width - icon.x - icon.width;
		expect(inset).toBeGreaterThanOrEqual(12);
		expect(inset).toBeLessThanOrEqual(20);
		expect(Math.abs(icon.y + icon.height / 2 - field.y - field.height / 2)).toBeLessThan(1);
		expect(field.height).toBeGreaterThanOrEqual(44);
		await filter.selectOption('failed');
		await expect(page.locator('.evidence-card')).toHaveCount(0);
		await expect(page.getByText('No matching evidence.', { exact: true })).toBeVisible();
		await filter.selectOption('passed');
		await expect(page.locator('.evidence-card')).toHaveCount(5);
		await filter.focus();
		await expect(filter).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(filter).not.toBeFocused();
		await expect(filter).toHaveValue('passed');
		await expect(page.locator('.evidence-card')).toHaveCount(5);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});
}
