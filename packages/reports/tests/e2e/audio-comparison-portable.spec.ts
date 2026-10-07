import { test, expect } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { audioPairFixture } from '../../test/audioPairFixture';
import { audioFixture } from '../../test/audioFixture';
import { ReportExportService } from '../../src/services/ReportExportService';
test('paired audio plays and downloads in portable HTML with the network offline', async ({
	page
}) => {
	const root = await mkdtemp(join(tmpdir(), 'audio-comparison-offline-'));
	try {
		const { store, run } = await audioPairFixture(root);
		await new ReportExportService(store).finalize(run.id);
		await page.context().setOffline(true);
		await page.goto(
			pathToFileURL(join(store.directory(run.id), 'exports', 'index.html')).toString()
		);
		await page
			.getByRole('button', {
				name: 'Open audio comparison: Paired recording',
				exact: true
			})
			.click();
		const pair = page.getByRole('dialog');
		await expect(pair).toBeVisible();
		const before = pair.getByRole('group', { name: 'Before recording' }).locator('audio');
		const after = pair.getByRole('group', { name: 'After recording' }).locator('audio');
		expect(await before.getAttribute('src')).toMatch(/^data:audio\/wav;base64,/);
		await before.evaluate(async (clip: HTMLAudioElement) => {
			await clip.play();
		});
		await after.evaluate(async (clip: HTMLAudioElement) => {
			await clip.play();
			clip.currentTime = 2;
		});
		await expect.poll(() => before.evaluate((clip: HTMLAudioElement) => clip.paused)).toBe(true);
		await expect
			.poll(() => after.evaluate((clip: HTMLAudioElement) => clip.currentTime))
			.toBeGreaterThanOrEqual(2);
		const download = page.waitForEvent('download');
		await pair
			.getByRole('group', { name: 'After recording' })
			.getByRole('link', { name: 'Download audio', exact: true })
			.click();
		expect(await readFile((await (await download).path())!)).toEqual(audioFixture(6, 440));
	} finally {
		await page.context().setOffline(false);
		await rm(root, { recursive: true, force: true });
	}
});
