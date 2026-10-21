import { expect, test } from '../../../../test/support/browserTest';
import { exampleDocument } from '../../../game/src/utils/keyDoor';
import { readFile } from 'node:fs/promises';
const projectId = 'local-' + 'a'.repeat(64);
const tiny =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
async function setup(page: import('@playwright/test').Page) {
	const sample = process.env.CHECKPOINT_IMAGE_FIXTURE;
	const png = sample ? (await readFile(sample)).toString('base64') : tiny;
	await page.addInitScript(
		({ document, projectId, png }) => {
			let saved = document;
			Object.assign(window, {
				__imageCalls: 0,
				harness: {
					gameRead: async () => ({
						document: JSON.parse(
							localStorage.getItem('checkpoint-document') || JSON.stringify(saved)
						),
						revision: 'b'.repeat(64)
					}),
					gameSave: async (input: { document: typeof document }) => {
						saved = input.document;
						localStorage.setItem('checkpoint-document', JSON.stringify(saved));
						return { revision: 'b'.repeat(64) };
					},
					gameImageGenerate: async (input: {
						projectId: string;
						viewId: string;
						checkpointId: string;
					}) => {
						Object.assign(window, {
							__imageCalls: (window as unknown as { __imageCalls: number }).__imageCalls + 1
						});
						return {
							image: {
								path: 'static/game/checkpoints/' + 'c'.repeat(64) + '.png',
								model: 'gpt-image-2',
								prompt: input.checkpointId,
								createdAt: '2026-10-20T12:00:00Z'
							},
							dataUrl: 'data:image/png;base64,' + png
						};
					},
					gameImageRead: async () => 'data:image/png;base64,' + png
				}
			});
		},
		{ document: exampleDocument(), projectId, png }
	);
	await page.goto('/game?projectId=' + projectId);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
}
test('checkpoint image generation persists with the graph and history stays read-only', async ({
	page
}) => {
	await setup(page);
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
		});
		await page.screenshot({ path: 'test-results/checkpoint-image-before.png', fullPage: true });
	}
	await expect(
		page.getByRole('button', { name: 'Generate checkpoint image', exact: true })
	).toBeVisible();
	await page
		.getByLabel('Checkpoint image direction', { exact: true })
		.fill('A brass key in a lush garden');
	await page.getByRole('button', { name: 'Generate checkpoint image', exact: true }).click();
	const reference = page.getByRole('img', {
		name: 'Collect the key gameplay reference',
		exact: true
	});
	await expect(reference).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Regenerate checkpoint image', exact: true })
	).toBeEnabled();
	expect(
		await page.evaluate(() => (window as unknown as { __imageCalls: number }).__imageCalls)
	).toBe(1);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await expect(reference).toBeVisible();
	await expect(page.getByLabel('Checkpoint image direction', { exact: true })).toHaveValue(
		'A brass key in a lush garden'
	);
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		await page.screenshot({ path: 'test-results/checkpoint-image-after.png', fullPage: true });
		await page
			.locator('[data-harness-component=game-checkpoint-image]')
			.screenshot({ path: 'test-results/checkpoint-image-panel.png' });
	}
	await page.goto('/game?projectId=' + projectId + '&commit=' + 'a'.repeat(40));
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await expect(reference).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Regenerate checkpoint image', exact: true })
	).toBeDisabled();
});

test('generation errors preserve the graph and late results never attach to another checkpoint', async ({
	page
}) => {
	await setup(page);
	await page
		.getByLabel('Checkpoint image direction', { exact: true })
		.fill('Keep this checkpoint direction');
	await page.evaluate(() => {
		const host = (window as unknown as { harness: { gameImageGenerate: () => Promise<unknown> } })
			.harness;
		host.gameImageGenerate = async () => {
			throw new Error('Image provider unavailable');
		};
	});
	await page.getByRole('button', { name: 'Generate checkpoint image', exact: true }).click();
	await expect(page.getByText('Image provider unavailable', { exact: true })).toBeVisible();
	await page.evaluate(() => {
		const host = (window as unknown as { harness: { gameImageGenerate: () => Promise<unknown> } })
			.harness;
		host.gameImageGenerate = () =>
			new Promise((resolve) =>
				Object.assign(window, {
					__deliverImage: () =>
						resolve({
							image: {
								path: 'static/game/checkpoints/' + 'c'.repeat(64) + '.png',
								model: 'gpt-image-2',
								prompt: 'key',
								createdAt: '2026-10-20T12:00:00Z'
							},
							dataUrl: 'data:image/png;base64,iVBORw0KGgo='
						})
				})
			);
	});
	await page.getByRole('button', { name: 'Generate checkpoint image', exact: true }).click();
	await page.getByText('Unlock the door', { exact: true }).first().click();
	await page.evaluate(() => (window as unknown as { __deliverImage: () => void }).__deliverImage());
	await expect(page.getByLabel('Checkpoint title', { exact: true })).toHaveValue('Unlock the door');
	await expect(
		page.getByRole('img', { name: 'Unlock the door gameplay reference', exact: true })
	).toHaveCount(0);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const saved = await page.evaluate(() => localStorage.getItem('checkpoint-document'));
	expect(saved).not.toContain('checkpoints/');
});

test('a generated game displays the saved reference after completing its checkpoint', async ({
	page
}) => {
	const url = process.env.CHECKPOINT_GAME_PROOF_URL;
	test.skip(!url, 'Run with the disposable generated-game server for standalone proof.');
	await page.goto(url + '/game');
	await page.reload();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({
			path: 'test-results/checkpoint-image-runtime-entry.png',
			fullPage: true
		});
	}
	await expect(page.locator('canvas')).toHaveAttribute('data-ready', 'true');
	await page.getByRole('button', { name: 'Move right', exact: true }).click({ clickCount: 2 });
	const reference = page.getByRole('img', {
		name: 'Collect the key gameplay reference',
		exact: true
	});
	await expect(reference).toBeVisible();
	await reference.evaluate(async (image) => {
		await (image as HTMLImageElement).decode();
	});
	expect(
		await reference.evaluate((image) => (image as HTMLImageElement).naturalWidth)
	).toBeGreaterThan(0);
	if (process.env.TAKE_SCREENSHOT === 'true')
		await page.screenshot({ path: 'test-results/checkpoint-image-runtime.png', fullPage: true });
});
