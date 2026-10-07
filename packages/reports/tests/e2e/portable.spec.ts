import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ReportExportService } from '../../src/services/ReportExportService';
import { reportProcess } from '../../src/utils/reportProcess';
import { reportPdf } from '../../src/utils/reportPdf';
const pixel =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
test('extracted ZIP gallery works offline and opens its registered image', async ({ page }) => {
	const root = await mkdtemp(join(tmpdir(), 'offline-report-'));
	try {
		const image = join(root, 'capture.png');
		await writeFile(image, Buffer.from(pixel, 'base64'));
		const store = new ReportRepository(root);
		const run = await store.begin({
			project: '/tmp/offline-project',
			title: 'Offline gallery proof',
			mode: 'feature',
			environment: 'local test',
			revision: 'test'
		});
		await store.record(run.id, {
			kind: 'check',
			data: { id: 'offline', title: 'Offline rendering', status: 'passed' }
		});
		await store.record(run.id, {
			kind: 'evidence',
			data: {
				id: 'capture',
				title: 'Captured view',
				category: 'UI',
				path: image,
				status: 'passed',
				note: 'What I did: Open the capture.\n\nWhat to notice: <strong>plain text</strong>.'
			}
		});
		await new ReportExportService(store).finalize(run.id);
		const zip = join(store.directory(run.id), 'exports', 'report.zip');
		const extracted = join(root, 'unpacked');
		await mkdir(extracted);
		const script = 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])';
		const result = await reportProcess(reportPdf(), ['-c', script, zip, extracted]);
		expect(result.code).toBe(0);
		await page.goto(pathToFileURL(join(extracted, 'index.html')).toString());
		await expect(page.getByRole('heading', { name: 'Offline gallery proof' })).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		expect(
			await page.locator('.evidence-card img').evaluate((image) => image.naturalWidth)
		).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Open Captured view' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Actual size' })).toBeVisible();
		await dialog.getByRole('button', { name: 'Actual size' }).click();
		await expect(dialog.getByRole('button', { name: 'Fit image' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			const folder = 'output/evidence/' + (process.env.SCREENSHOT_LABEL || 'current');
			await mkdir(folder, { recursive: true });
			await page.screenshot({ path: join(folder, 'portable-offline.png') });
		}
		expect(await dialog.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
			'0px'
		);
		await expect(
			dialog.getByText(
				'What I did: Open the capture.\n\nWhat to notice: <strong>plain text</strong>.',
				{ exact: true }
			)
		).toBeVisible();
		await expect(dialog.locator('figcaption strong')).toHaveCount(0);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
