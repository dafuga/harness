import { expect, test } from '../../../../test/support/browserTest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { fixtures } from './support/fixtures';
import { expectRetired, reportView } from './support/portableReport';

const pixel =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/** A report of two registered scene screenshots, or the one a caller named for this run. */
async function replayRun(): Promise<string> {
	if (process.env.REPLAY_FIXTURE_RUN) return process.env.REPLAY_FIXTURE_RUN;
	const store = new ReportRepository(fixtures.reports);
	const run = await store.begin({
		project: fixtures.site('alpha-project'),
		title: 'Replay of two scenes',
		mode: 'feature',
		environment: 'synthetic scene screenshots'
	});
	for (const scene of [1, 2]) {
		const path = join(store.directory(run.id), `scene-${scene}.png`);
		await writeFile(path, Buffer.from(pixel, 'base64'));
		await store.record(run.id, {
			kind: 'evidence',
			data: {
				id: `scene-${scene}`,
				title: `Scene 0${scene} — Fixture`,
				category: 'Gameplay',
				path,
				status: 'passed'
			}
		});
	}
	return run.id;
}

test('a report replays its scenes in the viewer and retains playback preferences', async ({
	page
}) => {
	const run = await replayRun();
	await page.goto(await reportView(run));
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		const directory = '/tmp/project-reports-replay';
		await mkdir(directory, { recursive: true });
		await writeFile(
			`${directory}/${process.env.SCREENSHOT_LABEL || 'current'}-replay-e2e.png`,
			await page.screenshot()
		);
	}
	await expect(page.getByRole('heading', { name: 'Gameplay replay', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
	await expect(page.getByLabel('Playback speed', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Replay timeline', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Playback speed', { exact: true })).toHaveValue('1');
	await expect(page.getByLabel('Jump to scene', { exact: true })).toHaveValue('1');
	await page.getByLabel('Playback speed', { exact: true }).selectOption('16');
	await page.getByRole('button', { name: 'Play replay', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
	await expect(page.getByLabel('Playback speed', { exact: true })).toHaveValue('16');
	await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Full screen', exact: true }).click();
	await expect(page.locator('.replay-player')).toHaveClass(/\bfull\b/);
	await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
	await expect(page.locator('.replay-player')).not.toHaveClass(/\bfull\b/);
});

test('the live report page is gone: its address leads into the explorer', async ({ page }) => {
	await expectRetired(page, '/reports/' + (await replayRun()));
	await expect(page.getByRole('heading', { name: 'Gameplay replay', exact: true })).toHaveCount(0);
});
