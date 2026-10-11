import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { fixtures, seededId } from './support/fixtures';
import { fits, pictured, screens, sharedField, typed } from './support/sharedSelect';

/**
 * Every choice on the report pages is the one shared select: the same caret, size and keyboard
 * on the hub filters and the comparison uploader as on the fields that were shared before.
 */
const card = (page: Page, title: string) => page.locator('.run-card').filter({ hasText: title });
const combo = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
const upload = '**/api/report-screenshot-upload';

for (const [screen, width, height] of screens) {
	test(`the report filters are the shared select and narrow the reports at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto('/harness/reports');
		const status = combo(page, 'Status');
		const mode = combo(page, 'Report mode');
		await expect(card(page, 'Whole-site review')).toBeVisible();
		await pictured(page, `hub-filters-${screen}`);
		await sharedField(status);
		await sharedField(mode);

		// Reached from the search field by Tab, and chosen by typing how the option begins.
		await page.getByRole('textbox', { name: 'Search reports' }).focus();
		await page.keyboard.press('Tab');
		await expect(status).toBeFocused();
		await page.keyboard.type('R');
		await expect(status).toHaveValue('running');
		await expect(card(page, 'Whole-site review')).toBeVisible();
		await expect(page.locator('.run-card .card-kicker .badge:not(.running)')).toHaveCount(0);
		await pictured(page, `hub-status-chosen-${screen}`);
		await status.selectOption('');

		await page.keyboard.press('Tab');
		await expect(mode).toBeFocused();
		await page.keyboard.type('Fu');
		await expect(mode).toHaveValue('suite');
		await expect(card(page, 'Whole-site review')).toBeVisible();
		await expect(card(page, 'Account settings review')).toHaveCount(0);
		await mode.selectOption('feature');
		await expect(card(page, 'Account settings review')).toBeVisible();
		await expect(card(page, 'Whole-site review')).toHaveCount(0);
		expect(await fits(page)).toBe(true);
	});

	test(`the upload viewport is the shared select, held during an upload and sent with it at ${screen} width`, async ({
		page
	}) => {
		const run = await new ReportRepository(fixtures.reports).begin({
			project: fixtures.site('alpha-project'),
			title: `Shared select upload at ${screen} width`,
			mode: 'feature',
			environment: 'local fixture'
		});
		await page.setViewportSize({ width, height });
		await page.goto(`/harness/reports/${run.id}`);
		await page.getByText('Add before/after comparison', { exact: true }).click();
		const form = page.locator('.upload-comparison');
		const viewport = form.getByRole('combobox', { name: 'Viewport', exact: true });
		await expect(viewport).toHaveValue('');
		await pictured(page, `upload-viewport-${screen}`);
		await sharedField(viewport);
		// The word above the field is its label: pressing it puts the keyboard in the field.
		await form.locator('label', { hasText: 'Viewport' }).click({ position: { x: 6, y: 6 } });
		await expect(viewport).toBeFocused();
		await page.keyboard.type('9');
		await expect(viewport).toHaveValue('tablet');
		await pictured(page, `upload-viewport-chosen-${screen}`);

		let release = () => {};
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route(upload, async (route) => {
			await held;
			await route.continue();
		});
		await form.getByLabel('Comparison title').fill('Tablet pair');
		const image = join(fixtures.reports, 'fixture.png');
		await form.locator('input[name="before"]').setInputFiles(image);
		await form.locator('input[name="after"]').setInputFiles(image);
		await form.getByRole('button', { name: 'Upload comparison' }).click();
		// While the pair is on its way the choice cannot change, and the field shows that.
		await expect(viewport).toBeDisabled();
		await expect(viewport).toHaveValue('tablet');
		await pictured(page, `upload-viewport-held-${screen}`);
		expect(await viewport.locator('..').evaluate((held) => getComputedStyle(held).opacity)).toBe(
			'0.5'
		);
		release();
		await expect(form.getByRole('status')).toContainText('Added to gallery');
		// The pair kept the viewport that was chosen, and the form is clear for the next one.
		const pair = page.locator('.evidence-card').filter({ hasText: 'Tablet pair' });
		await expect(pair.first().locator('.evidence-meta')).toContainText('920px tablet');
		await expect(viewport).toBeEnabled();
		await expect(viewport).toHaveValue('');
		expect(await fits(page)).toBe(true);
	});

	test(`the fields that were the shared select before are the same field at ${screen} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height });
		await page.goto(`/harness/reports/${await seededId()}`);
		const speed = combo(page, 'Playback speed');
		await sharedField(speed);
		await typed(page, speed, '16');
		await expect(speed).toHaveValue('16');
		await sharedField(combo(page, 'Status'));
		await page.getByText('Add audio', { exact: true }).click();
		const audio = combo(page, 'Audio upload mode');
		await expect(audio).toBeEnabled();
		await sharedField(audio);
		await pictured(page, `report-shared-before-${screen}`);
		await typed(page, audio, 'B');
		await expect(audio).toHaveValue('comparison');
		await expect(page.getByLabel('Before audio file', { exact: true })).toHaveCount(1);
		expect(await fits(page)).toBe(true);
	});
}
