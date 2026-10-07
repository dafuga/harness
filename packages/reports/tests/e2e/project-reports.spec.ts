import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
async function capture(page: import('@playwright/test').Page, name: string, fullPage = true) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = `output/evidence/${process.env.SCREENSHOT_LABEL || 'current'}`;
	await mkdir(directory, { recursive: true });
	await page.evaluate(async () => {
		await document.fonts.ready;
		for (const image of document.querySelectorAll('img')) {
			const bounds = image.getBoundingClientRect();
			if (bounds.width === 0 || bounds.height === 0) continue;
			await image.decode();
			if (!image.complete || image.naturalWidth === 0) throw new Error('Image is not ready');
		}
	});
	await page.screenshot({ path: `${directory}/${name}.png`, fullPage });
}
for (const width of [1440, 390])
	test(`report details open as separate modals at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		await capture(page, `details-default-${width}`);
		await expect(page.locator('.review-grid')).toHaveCount(0);
		await expect(page.getByText('Save settings', { exact: true })).toHaveCount(0);
		await expect(page.getByText('Device verification pending')).toHaveCount(0);
		for (const [label, detail] of [
			['Verification', 'Save settings'],
			['Acceptance criteria', 'Settings remain readable on mobile'],
			['Workflow coverage', 'Device verification pending']
		]) {
			const trigger = page.getByRole('button', { name: new RegExp(`^${label},`) });
			await trigger.click();
			const dialog = page.getByRole('dialog', { name: label });
			await expect(dialog).toBeVisible();
			await expect(dialog.getByText(detail, { exact: true })).toBeVisible();
			if (label === 'Verification') {
				await dialog.getByText('Commands and logs').click();
				await expect(dialog.getByText('bun run check')).toBeVisible();
			}
			await capture(page, `details-${label.toLowerCase().replaceAll(' ', '-')}-${width}`, false);
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			await expect(trigger).toBeFocused();
		}
	});
for (const width of [1104, 390])
	test(`report header keeps audit details on demand at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 998 });
		const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		await capture(page, `header-default-${width}`);
		const galleryTop = await page
			.locator('.gallery-section')
			.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
		expect(galleryTop).toBeLessThan(width === 390 ? 1100 : 750);
		const details = page.locator('.run-details');
		await expect(details.locator('summary')).toContainText('Run details & downloads');
		await expect(page.getByText('local fixture')).not.toBeVisible();
		await details.locator('summary').click();
		await expect(details.getByText('local fixture')).toBeVisible();
		await expect(details.getByText('Not proven').first()).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		if (width === 390) {
			const box = await details.locator('summary').boundingBox();
			expect(box?.height).toBeGreaterThanOrEqual(44);
		}
	});
test('hub finds reports across projects and filters search', async ({ page }) => {
	await page.goto('/');
	await capture(page, 'hub');
	await expect(page.getByRole('heading', { name: 'Project reports', exact: true })).toBeVisible();
	await expect(page.getByText('Account settings review', { exact: true })).toBeVisible();
	await page.getByPlaceholder('Search projects and reports').fill('Whole-site');
	await expect(page.getByText('Account settings review', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Whole-site review', { exact: true })).toBeVisible();
});
test('screen-size controls remain comfortably tappable on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.waitForLoadState('networkidle');
	await page
		.locator('.gallery-section')
		.evaluate((element) => element.scrollIntoView({ block: 'start' }));
	await capture(page, 'visual-polish-mobile');
	for (const button of await page.locator('.viewport-tabs button').all()) {
		const bounds = await button.boundingBox();
		expect(bounds?.height).toBeGreaterThanOrEqual(44);
	}
});
test('viewer switches a standalone capture to another available screen size', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open Camera controls' }).click();
	const dialog = page.getByRole('dialog', { name: 'Camera controls' });
	await expect(dialog).toBeVisible();
	await capture(page, 'standalone-size-switch-before', false);
	await expect(dialog.getByRole('button', { name: 'View tablet screenshots' })).toBeVisible();
	await dialog.getByRole('button', { name: 'View tablet screenshots' }).click();
	await expect(page.getByRole('dialog', { name: 'Settings after' })).toBeVisible();
	await expect(page.getByRole('dialog').getByText('920px tablet')).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Tablet screenshots', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
});
test('viewer marks uncaptured screen sizes unavailable', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const id = (await readFile(resolve('/tmp/project-reports-e2e/mobile-id'), 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open Mobile field view' }).click();
	const dialog = page.getByRole('dialog', { name: 'Mobile field view' });
	await expect(dialog).toBeVisible();
	await capture(page, 'mobile-only-size-switch-before', false);
	await expect(dialog.getByRole('button', { name: 'View mobile screenshots' })).toBeEnabled();
	await expect(dialog.getByRole('button', { name: 'View tablet screenshots' })).toBeDisabled();
	await expect(dialog.getByRole('button', { name: 'View desktop screenshots' })).toBeDisabled();
});
test('viewer size controls omit screenshot totals', async ({ page }) => {
	const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open Settings after' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Settings after' });
	await capture(page, 'viewer-size-labels', false);
	for (const size of ['Mobile', 'Tablet', 'Desktop']) {
		await expect(
			dialog.getByRole('button', { name: `View ${size.toLowerCase()} screenshots` })
		).toHaveText(`${size} screenshots`);
	}
});
for (const width of [1104, 390])
	test(`screenshot viewer has no outer modal frame at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 998 });
		const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: 'Open Settings after' }).first().click();
		const dialog = page.getByRole('dialog', { name: 'Settings after' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'View mobile screenshots' })).toBeVisible();
		await capture(page, `lightbox-${width}`, false);
		const frame = await dialog.evaluate((element) => {
			const box = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return { x: box.x, y: box.y, width: box.width, border: style.borderTopWidth };
		});
		expect(frame.x).toBeLessThan(3);
		expect(frame.y).toBeLessThan(3);
		expect(frame.width).toBeGreaterThan(width - 4);
		expect(frame.border).toBe('0px');
		expect(
			await dialog
				.locator('.viewer-images img')
				.first()
				.evaluate((element) => getComputedStyle(element).boxShadow)
		).toBe('none');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: /^Verification,/ }).click();
		const textDialog = page.getByRole('dialog', { name: 'Verification' });
		await expect(textDialog).toBeVisible();
		expect(
			await textDialog.evaluate((element) => getComputedStyle(element).borderTopWidth)
		).not.toBe('0px');
	});
for (const width of [1440, 920, 390])
	test(`report filters, compares and handles keyboard at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		const id = (await readFile(resolve('/tmp/project-reports-e2e/fixture-id'), 'utf8')).trim();
		await page.goto(`/reports/${id}`);
		await page.waitForLoadState('networkidle');
		await capture(page, `report-${width}`);
		await expect(
			page.getByRole('heading', { name: 'Account settings review', exact: true })
		).toBeVisible();
		await page.getByRole('button', { name: /^Workflow coverage,/ }).click();
		await expect(
			page
				.getByRole('dialog', { name: 'Workflow coverage' })
				.getByText('Device verification pending')
		).toBeVisible();
		await page.keyboard.press('Escape');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		const gallery = page.locator('.gallery-section');
		await expect(gallery.getByRole('button', { name: 'Open Settings before' })).toHaveCount(0);
		await expect(gallery.getByText('Synthetic report UI test fixture')).toHaveCount(0);
		await expect(gallery.getByText('2 hours ago')).toHaveCount(3);
		await expect(gallery.getByRole('button', { name: 'Open Settings after' })).toHaveCount(3);
		await gallery.getByRole('button', { name: 'Tablet screenshots' }).click();
		await expect(gallery.getByRole('button', { name: 'Open Settings after' })).toHaveCount(1);
		await gallery.getByRole('button', { name: 'All screen sizes' }).click();
		await page.getByRole('button', { name: 'Open Settings after', exact: true }).first().click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByRole('button', { name: 'View tablet screenshots' }).click();
		await expect(page.getByRole('dialog').getByText('920px tablet')).toBeVisible();
		await capture(page, `viewer-after-${width}`, false);
		await page.getByRole('button', { name: 'View before screenshot' }).click();
		await expect(page.getByRole('dialog').getByText('Before · Settings before')).toBeVisible();
		await expect(page.getByRole('dialog', { name: 'Settings before' })).toBeVisible();
		await capture(page, `viewer-before-${width}`, false);
		await page.getByRole('button', { name: 'View after screenshot' }).click();
		await page.getByRole('button', { name: 'Compare before and after' }).click();
		await expect(page.getByRole('dialog').locator('img')).toHaveCount(2);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});
