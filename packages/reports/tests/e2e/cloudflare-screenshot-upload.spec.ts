import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ScreenshotRetentionService } from '../../src/services/ScreenshotRetentionService';

async function capture(page: import('@playwright/test').Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const directory = `output/evidence/${process.env.SCREENSHOT_LABEL || 'current'}`;
	await mkdir(directory, { recursive: true });
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.querySelectorAll('img')].map((image) => image.decode()));
	});
	await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}

test('an active report uploads and displays a before/after pair', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	const id = (await readFile('/tmp/project-reports-e2e/fixture-id', 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await capture(page, 'upload-entry');
	const disclosure = page.getByText('Add before/after comparison', { exact: true });
	await expect(disclosure).toBeVisible();
	await disclosure.click();
	await page.getByLabel('Comparison title').fill('Uploaded checkout flow');
	await page.locator('select[name="viewport"]').selectOption('desktop');
	const image = resolve('/tmp/project-reports-e2e/fixture.png');
	await page.locator('input[name="before"]').setInputFiles(image);
	await page.locator('input[name="after"]').setInputFiles(image);
	await page.getByRole('button', { name: 'Upload comparison' }).click();
	await expect(page.getByRole('status')).toContainText('Added to gallery');
	await expect(
		page.getByRole('button', { name: 'Open Uploaded checkout flow after' })
	).toBeVisible();
	await capture(page, 'upload-pair');
	await page.getByRole('button', { name: 'Open Uploaded checkout flow after' }).click();
	const dialog = page.getByRole('dialog', { name: 'Uploaded checkout flow after' });
	await expect(dialog.getByRole('button', { name: 'View before screenshot' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Compare before and after' }).click();
	await expect(dialog.locator('img')).toHaveCount(2);
});

test('mobile upload controls fit and the new pair remains visible', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const id = (await readFile('/tmp/project-reports-e2e/fixture-id', 'utf8')).trim();
	await page.goto(`/reports/${id}`);
	await page.getByText('Add before/after comparison', { exact: true }).click();
	await page.getByLabel('Comparison title').fill('Mobile upload proof');
	await page.locator('select[name="viewport"]').selectOption('mobile');
	const image = resolve('/tmp/project-reports-e2e/fixture.png');
	await page.locator('input[name="before"]').setInputFiles(image);
	await page.locator('input[name="after"]').setInputFiles(image);
	await capture(page, 'upload-form-mobile');
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.getByRole('button', { name: 'Upload comparison' }).click();
	await expect(page.getByRole('button', { name: 'Open Mobile upload proof after' })).toBeVisible();
	await capture(page, 'upload-pair-mobile');
});

test('multipart upload accepts realistic screenshots above the default body limit', async ({
	request,
	baseURL
}) => {
	const id = (await readFile('/tmp/project-reports-e2e/fixture-id', 'utf8')).trim();
	const image = await readFile('/tmp/project-reports-e2e/large.png');
	expect(image.length).toBeGreaterThan(512_000);
	const response = await request.post('/api/report-screenshot-upload', {
		headers: { Origin: baseURL! },
		multipart: {
			reportId: id,
			title: 'Large image proof',
			viewport: 'desktop',
			before: { name: 'before.png', mimeType: 'image/png', buffer: image },
			after: { name: 'after.png', mimeType: 'image/png', buffer: image }
		}
	});
	expect(response.status()).toBe(201);
	const report = await response.json();
	const asset = report.evidence.find(
		(item: { title: string }) => item.title === 'Large image proof after'
	);
	const served = await request.get(`/api/reports/${id}/assets/${asset.file}`);
	expect(served.status()).toBe(200);
	expect((await served.body()).length).toBe(image.length);
});

test('expired uploads retain a readable report without downloadable image bytes', async ({
	page,
	request
}) => {
	const repository = new ReportRepository('/tmp/project-reports-e2e');
	const report = await repository.begin({
		project: '/tmp/alpha-project',
		title: 'Retention review',
		mode: 'feature',
		environment: 'local fixture'
	});
	await page.goto(`/reports/${report.id}`);
	await page.getByText('Add before/after comparison', { exact: true }).click();
	await page.getByLabel('Comparison title').fill('Retention proof');
	const image = resolve('/tmp/project-reports-e2e/fixture.png');
	await page.locator('input[name="before"]').setInputFiles(image);
	await page.locator('input[name="after"]').setInputFiles(image);
	await page.getByRole('button', { name: 'Upload comparison' }).click();
	await expect(page.getByRole('status')).toContainText('Added to gallery');
	await capture(page, 'retention-before');
	const manifest = repository.directory(report.id) + '/manifest.json';
	const stored = await repository.get(report.id);
	const file = stored.evidence[1].file;
	for (const item of stored.evidence)
		item.capturedAt = new Date(Date.now() - 31 * 86_400_000).toISOString();
	await writeFile(manifest, JSON.stringify(stored));
	const cleanup = await new ScreenshotRetentionService(repository).run();
	expect(cleanup.expired).toBe(2);
	await page.reload();
	const card = page.locator('.evidence-card').filter({ hasText: 'Retention proof after' });
	await expect(card).toContainText('Screenshot expired after 30 days');
	await expect(card.locator('.image-button')).toBeDisabled();
	await capture(page, 'retention-after');
	expect((await request.get(`/api/reports/${report.id}/assets/${file}`)).status()).toBe(410);
});
