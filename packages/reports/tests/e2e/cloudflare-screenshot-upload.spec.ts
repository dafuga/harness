import type { Upload } from './cloudflare-screenshot-upload.spec.types';
import { expect, test, type APIRequestContext } from '../../../../test/support/browserTest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { ScreenshotRetentionService } from '../../src/services/ScreenshotRetentionService';
import { fixtures, seededId } from './support/fixtures';
import { expectRetired, servedReport } from './support/portableReport';

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

/**
 * Posts a before/after pair to the upload service, as the removed form of the report page did.
 * The pair goes to the object store of the run, so the viewer reads it back through the API.
 */
/** An active report of the hosting application, so that a run that is repeated starts clean. */
async function begun(title: string): Promise<string> {
	const repository = new ReportRepository(fixtures.reports);
	const report = await repository.begin({
		project: fixtures.site('alpha-project'),
		title,
		mode: 'feature',
		environment: 'local fixture'
	});
	return report.id;
}

async function upload(request: APIRequestContext, origin: string, fields: Upload) {
	const image = await readFile(join(fixtures.reports, 'fixture.png'));
	const file = (name: string) => ({ name, mimeType: 'image/png', buffer: image });
	const response = await request.post('/api/report-screenshot-upload', {
		headers: { Origin: origin },
		multipart: { ...fields, before: file('before.png'), after: file('after.png') }
	});
	expect(response.status()).toBe(201);
	return response.json();
}

test('the upload service adds a before/after pair that the viewer displays', async ({
	page,
	request,
	baseURL
}) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	const id = await begun('Upload review');
	await expectRetired(page, `/reports/${id}`);
	await expect(page.getByText('Add before/after comparison', { exact: true })).toHaveCount(0);
	const fields = { reportId: id, title: 'Uploaded checkout flow', viewport: 'desktop' };
	const report = await upload(request, baseURL!, fields);
	const added = report.evidence.filter((item: { title: string }) =>
		item.title.startsWith('Uploaded checkout flow')
	);
	expect(added.map((item: { phase: string }) => item.phase)).toEqual(['before', 'after']);
	await page.goto(await servedReport(id, baseURL!));
	await expect(
		page.getByRole('button', { name: 'Open Uploaded checkout flow after' })
	).toBeVisible();
	await capture(page, 'upload-pair');
	await page.getByRole('button', { name: 'Open Uploaded checkout flow after' }).click();
	const dialog = page.getByRole('dialog', { name: 'Uploaded checkout flow after' });
	await expect(dialog.getByRole('button', { name: 'View before screenshot' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Compare before and after' }).click();
	await expect(dialog.locator('img')).toHaveCount(2);
	// Both pictures are the bytes the object store kept, read back through the report API.
	for (const image of await dialog.locator('img').all()) {
		await expect
			.poll(() => image.evaluate((shown: HTMLImageElement) => shown.naturalWidth))
			.toBeGreaterThan(0);
	}
});

test('an uploaded mobile pair remains visible and the viewer fits a phone', async ({
	page,
	request,
	baseURL
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const id = await begun('Mobile upload review');
	await upload(request, baseURL!, {
		reportId: id,
		title: 'Mobile upload proof',
		viewport: 'mobile'
	});
	await page.goto(await servedReport(id, baseURL!));
	const opener = page.getByRole('button', { name: 'Open Mobile upload proof after' });
	await expect(opener).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await capture(page, 'upload-pair-mobile');
	// A pair without a title or without a known screen size is refused, and adds nothing.
	const refused = await request.post('/api/report-screenshot-upload', {
		headers: { Origin: baseURL! },
		multipart: { reportId: id, title: '', viewport: 'mobile' }
	});
	expect(refused.status()).toBe(400);
});

test('multipart upload accepts realistic screenshots above the default body limit', async ({
	request,
	baseURL
}) => {
	const id = await seededId();
	const image = await readFile(join(fixtures.reports, 'large.png'));
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
	request,
	baseURL
}) => {
	const repository = new ReportRepository(fixtures.reports);
	const report = await repository.begin({
		project: fixtures.site('alpha-project'),
		title: 'Retention review',
		mode: 'feature',
		environment: 'local fixture'
	});
	await upload(request, baseURL!, {
		reportId: report.id,
		title: 'Retention proof',
		viewport: 'desktop'
	});
	await page.goto(await servedReport(report.id, baseURL!));
	await expect(page.getByRole('button', { name: 'Open Retention proof after' })).toBeVisible();
	await capture(page, 'retention-before');
	const manifest = repository.directory(report.id) + '/manifest.json';
	const stored = await repository.get(report.id);
	const file = stored.evidence[1].file;
	for (const item of stored.evidence)
		item.capturedAt = new Date(Date.now() - 31 * 86_400_000).toISOString();
	await writeFile(manifest, JSON.stringify(stored));
	const cleanup = await new ScreenshotRetentionService(repository).run();
	expect(cleanup.expired).toBe(2);
	await page.goto(await servedReport(report.id, baseURL!));
	const card = page.locator('.evidence-card').filter({ hasText: 'Retention proof after' });
	await expect(card).toContainText('Screenshot expired after 30 days');
	await expect(card.locator('.image-button')).toBeDisabled();
	await capture(page, 'retention-after');
	expect((await request.get(`/api/reports/${report.id}/assets/${file}`)).status()).toBe(410);
});
