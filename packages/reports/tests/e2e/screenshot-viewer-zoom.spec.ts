import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function capture(page: Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = `output/evidence/${process.env.SCREENSHOT_LABEL || 'current'}`;
	await mkdir(directory, { recursive: true });
	await page.evaluate(async () => {
		await document.fonts.ready;
		const image = document.querySelector<HTMLImageElement>('dialog .viewer-images img');
		await image?.decode();
		if (!image?.complete || !image.naturalWidth) throw new Error('Viewer image is not ready');
	});
	await page.screenshot({ path: `${directory}/${name}.png` });
}

for (const width of [1440, 390]) {
	test(`screenshot explanations follow the viewed image at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Open Settings after', exact: true }).first().click();
		const dialog = page.getByRole('dialog');
		await dialog.evaluate((element) => (element.scrollTop = element.scrollHeight));
		await capture(page, `screenshot-explanation-${width}`);
		const after = 'Synthetic report UI test fixture\n\n390px mobile: after';
		const before = 'Synthetic report UI test fixture\n\n390px mobile: before';
		await expect(dialog.getByText(after, { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'View before screenshot' }).click();
		await expect(dialog.getByText(before, { exact: true })).toBeVisible();
		await expect(dialog.getByText(after, { exact: true })).toHaveCount(0);
		await page.getByRole('button', { name: 'View after screenshot' }).click();
		for (let index = 0; index < 3; index++)
			await page.getByRole('button', { name: 'Next image' }).click();
		await expect(dialog.getByRole('img', { name: 'Camera controls' })).toBeVisible();
		await expect(dialog.getByText(after, { exact: true })).toHaveCount(0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
	});
}

for (const width of [1440, 390]) {
	test(`tall screenshot zooms to original pixels inside the viewer at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Open Tall report page' }).click();
		const dialog = page.getByRole('dialog', { name: 'Tall report page' });
		const image = dialog.getByRole('img', { name: 'Tall report page' });
		await expect(image).toBeVisible();
		await image.evaluate((element: HTMLImageElement) => element.decode());
		const naturalWidth = await image.evaluate((element: HTMLImageElement) => element.naturalWidth);
		const fittedWidth = (await image.boundingBox())!.width;
		expect(fittedWidth).toBeLessThan(naturalWidth / 2);
		await capture(page, `zoom-fit-${width}`);
		await expect(dialog.getByRole('button', { name: 'Actual size' })).toBeVisible();
		await dialog.getByRole('button', { name: 'Actual size' }).click();
		await expect.poll(async () => (await image.boundingBox())!.width).toBe(naturalWidth);
		await capture(page, `zoom-actual-${width}`);
		await dialog.getByRole('button', { name: 'Zoom in' }).click();
		expect((await image.boundingBox())!.width).toBeGreaterThan(naturalWidth);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await dialog.getByRole('button', { name: 'Fit image' }).click();
		await expect
			.poll(async () => (await image.boundingBox())!.width)
			.toBeLessThan(naturalWidth / 2);
		await dialog.getByRole('button', { name: 'Actual size' }).click();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(
			page.getByRole('dialog').getByRole('button', { name: 'Fit image' })
		).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});
}

test('Mac trackpad pinches to zoom and two-finger scrolls to pan the image', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open Tall report page' }).click();
	const dialog = page.getByRole('dialog', { name: 'Tall report page' });
	const image = dialog.getByRole('img', { name: 'Tall report page' });
	const stage = dialog.locator('.stage');
	await image.evaluate((element: HTMLImageElement) => element.decode());
	const fittedWidth = (await image.boundingBox())!.width;
	const box = (await stage.boundingBox())!;
	const pointer = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 180) };
	const fittedBox = (await image.boundingBox())!;
	const imageYAtPointer = (pointer.y - fittedBox.y) / fittedBox.height;
	await page.mouse.move(pointer.x, pointer.y);
	await page.keyboard.down('Control');
	await page.mouse.wheel(0, -120);
	await page.keyboard.up('Control');
	await capture(page, 'trackpad-pinch-1440');
	await expect.poll(async () => (await image.boundingBox())!.width).toBeGreaterThan(fittedWidth);
	const enlargedBox = (await image.boundingBox())!;
	expect(Math.abs((pointer.y - enlargedBox.y) / enlargedBox.height - imageYAtPointer)).toBeLessThan(
		0.03
	);
	await dialog.getByRole('button', { name: 'Actual size' }).click();
	await expect
		.poll(async () => stage.evaluate((node) => node.scrollHeight))
		.toBeGreaterThan(await stage.evaluate((node) => node.clientHeight));
	await stage.evaluate((node) => (node.scrollTop = 0));
	const zoomedBox = (await stage.boundingBox())!;
	await page.mouse.move(zoomedBox.x + zoomedBox.width / 2, zoomedBox.y + 120);
	const initialTop = await stage.evaluate((node) => node.scrollTop);
	await page.mouse.wheel(0, 240);
	await expect
		.poll(async () => stage.evaluate((node) => node.scrollTop))
		.toBeGreaterThan(initialTop);
});

test('a gentle trackpad pinch responds to successive small movements from fit', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open Tall report page' }).click();
	const dialog = page.getByRole('dialog', { name: 'Tall report page' });
	const image = dialog.getByRole('img', { name: 'Tall report page' });
	await image.evaluate((element: HTMLImageElement) => element.decode());
	const fittedWidth = (await image.boundingBox())!.width;
	const stage = dialog.locator('.stage');
	const box = (await stage.boundingBox())!;
	const pointer = { x: box.x + box.width / 2, y: box.y + 180 };
	const fittedImage = (await image.boundingBox())!;
	const imageYAtPointer = (pointer.y - fittedImage.y) / fittedImage.height;
	await page.mouse.move(pointer.x, pointer.y);
	await page.keyboard.down('Control');
	let previousWidth = fittedWidth;
	for (let index = 0; index < 18; index++) {
		await page.mouse.wheel(0, -2);
		await expect
			.poll(async () => (await image.boundingBox())!.width)
			.toBeGreaterThan(previousWidth * 1.005);
		previousWidth = (await image.boundingBox())!.width;
	}
	await page.keyboard.up('Control');
	await capture(page, 'trackpad-gentle-pinch-1440');
	expect(previousWidth).toBeGreaterThan(fittedWidth * 1.4);
	expect(previousWidth).toBeLessThan(fittedWidth * 1.46);
	const enlarged = (await image.boundingBox())!;
	expect(Math.abs((pointer.y - enlarged.y) / enlarged.height - imageYAtPointer)).toBeLessThan(0.03);
	await page.keyboard.down('Control');
	for (let index = 0; index < 18; index++) await page.mouse.wheel(0, 2);
	await page.keyboard.up('Control');
	await expect
		.poll(async () => (await image.boundingBox())!.width)
		.toBeLessThanOrEqual(fittedWidth * 1.02);
	await expect(dialog.getByRole('button', { name: 'Fit image' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
