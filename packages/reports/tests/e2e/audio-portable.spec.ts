import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ReportExportService } from '../../src/services/ReportExportService';
import { reportProcess } from '../../src/utils/reportProcess';
import { reportPdf } from '../../src/utils/reportPdf';
import { audioFixture } from '../../test/audioFixture';
import type { Page } from '@playwright/test';

async function reportAppearance(page: Page) {
	return page.evaluate(() =>
		['html', '.outcome-strip', '.title-row .badge', '.review-launch'].map((selector) => {
			const style = getComputedStyle(document.querySelector(selector)!);
			return [
				selector === 'html' ? style.backgroundColor : null,
				style.display,
				style.borderRadius,
				style.gap
			];
		})
	);
}
async function offlineReport(root: string) {
	const path = join(root, 'sound.wav');
	await writeFile(path, audioFixture(6));
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/offline-audio',
		title: 'Offline audio proof',
		mode: 'feature',
		environment: 'synthetic fixture'
	});
	for (const id of ['first', 'second'])
		await store.record(run.id, {
			kind: 'evidence',
			data: {
				id,
				title: id + ' recording',
				path,
				status: 'failed',
				source: 'Synthetic tone',
				transcript: 'Test tone for ' + id
			}
		});
	await new ReportExportService(store).finalize(run.id);
	const target = join(root, 'unpacked');
	await mkdir(target);
	const zip = join(store.directory(run.id), 'exports', 'report.zip');
	const script =
		'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert len([n for n in z.namelist() if n.endswith(".wav")])==1; z.extractall(sys.argv[2])';
	const result = await reportProcess(reportPdf(), ['-c', script, zip, target]);
	expect(result.code).toBe(0);
	return target;
}
test('portable report preserves the canonical website theme, badges and outcome layout', async ({
	page
}) => {
	const root = await mkdtemp(join(tmpdir(), 'portable-report-appearance-'));
	try {
		const target = await offlineReport(root);
		const fixtureId = await readFile('/tmp/project-reports-e2e/fixture-id', 'utf8');
		await page.goto('/reports/' + fixtureId);
		const canonical = await reportAppearance(page);
		await page.goto(pathToFileURL(join(target, 'index.html')).toString());
		await page.evaluate(() => document.fonts.ready);
		if (process.env.TAKE_SCREENSHOT === 'true') {
			const directory = 'output/evidence/' + (process.env.SCREENSHOT_LABEL || 'current');
			await mkdir(directory, { recursive: true });
			await page.screenshot({ path: join(directory, 'portable-report-appearance.png') });
		}
		expect(await reportAppearance(page)).toEqual(canonical);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test('portable HTML plays and seeks offline with one active clip and deduplicated original ZIP bytes', async ({
	page
}) => {
	const root = await mkdtemp(join(tmpdir(), 'offline-audio-'));
	try {
		const target = await offlineReport(root);
		await page.context().setOffline(true);
		await page.goto(pathToFileURL(join(target, 'index.html')).toString());
		await expect(page.getByRole('heading', { name: 'Offline audio proof' })).toBeVisible();
		const first = page.locator('#evidence-first audio'),
			second = page.locator('#evidence-second audio');
		await expect(page.locator('#evidence-first .audio-transcript')).toBeVisible();
		await expect(page.locator('#evidence-second .audio-transcript')).toBeVisible();
		expect(await first.getAttribute('src')).toMatch(/^data:audio\/wav;base64,/);
		await first.evaluate(async (audio: HTMLAudioElement) => {
			await audio.play();
		});
		await expect
			.poll(() => first.evaluate((audio: HTMLAudioElement) => audio.currentTime))
			.toBeGreaterThan(0);
		await second.evaluate(async (audio: HTMLAudioElement) => {
			await audio.play();
			audio.currentTime = 3;
		});
		await expect.poll(() => first.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
		await expect
			.poll(() => second.evaluate((audio: HTMLAudioElement) => audio.currentTime))
			.toBeGreaterThanOrEqual(3);
		await expect(page.locator('#evidence-second')).toContainText('Failed');
		expect(await second.evaluate((audio) => getComputedStyle(audio).colorScheme)).toContain('dark');
		const download = page.waitForEvent('download');
		await page.locator('#evidence-second').getByRole('link', { name: 'Download audio' }).click();
		const file = await download;
		expect(await readFile((await file.path())!)).toEqual(audioFixture(6));
	} finally {
		await page.context().setOffline(false);
		await rm(root, { recursive: true, force: true });
	}
});
