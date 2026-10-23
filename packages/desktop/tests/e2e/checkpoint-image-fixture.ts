import { readFile } from 'node:fs/promises';
import { exampleDocument } from '../../../game/src/utils/game-authoring/keyDoor';
export const projectId = 'local-' + 'a'.repeat(64);
export const tiny =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
export async function setup(page: import('@playwright/test').Page) {
	const sample = process.env.CHECKPOINT_IMAGE_FIXTURE;
	const png = sample ? (await readFile(sample)).toString('base64') : tiny;
	await page.addInitScript(
		({ document, projectId, png }) => {
			let saved = document;
			Object.assign(window, {
				__imageCalls: 0,
				__imageReads: 0,
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
					gameImageRead: async () => {
						const counted = window as unknown as { __imageReads: number };
						counted.__imageReads++;
						return 'data:image/png;base64,' + png;
					}
				}
			});
		},
		{ document: exampleDocument(), projectId, png }
	);
	await page.goto('/game?projectId=' + projectId);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
}

/** Failed requests preserve the typed direction; deferred results belong only to their modal. */
export async function imageFailureAndLateResults(page: import('@playwright/test').Page) {
	const { expect } = await import('@playwright/test');
	const prompt = page.getByLabel('Describe your checkpoint', { exact: true });
	await prompt.fill('Keep this checkpoint direction');
	await page.evaluate(() => {
		const host = (window as unknown as { harness: Record<string, unknown> }).harness;
		host.gameImageGenerate = async () => {
			throw new Error('Image provider unavailable');
		};
	});
	await page.getByRole('button', { name: 'Generate image', exact: true }).click();
	await expect(page.getByText('Image provider unavailable', { exact: true })).toBeVisible();
	await expect(prompt).toHaveValue('Keep this checkpoint direction');
	await deferredImages(page);
	await page.getByRole('button', { name: 'Generate image', exact: true }).click();
	await deliverImage(page);
	await expect(
		page.getByRole('img', { name: 'New checkpoint image for Collect the key', exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Use this image', exact: true }).click();
	await unreadableReference(page);
	await page.getByRole('button', { name: 'Generate image', exact: true }).click();
	await prompt.fill('Moonlit courtyard');
	await deliverImage(page);
	await expect(
		page.getByRole('img', { name: 'New checkpoint image for Collect the key', exact: true })
	).toBeVisible();
	await expect(page.getByText(/Made before your latest edits/)).toBeVisible();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await page.getByRole('button', { name: 'Generate image', exact: true }).click();
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.getByText('Unlock the door', { exact: true }).first().click();
	await deliverImage(page);
	await expect(page.getByLabel('Checkpoint title', { exact: true })).toHaveValue('Unlock the door');
	await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	expect(await page.evaluate(() => localStorage.getItem('checkpoint-document'))).not.toContain(
		'checkpoints/'
	);
}

async function deferredImages(page: import('@playwright/test').Page) {
	await page.evaluate((png) => {
		const host = (window as unknown as { harness: Record<string, unknown> }).harness;
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
							dataUrl: 'data:image/png;base64,' + png
						})
				})
			);
	}, tiny);
}

async function deliverImage(page: import('@playwright/test').Page) {
	await page.evaluate(() => (window as unknown as { __deliverImage: () => void }).__deliverImage());
}

async function unreadableReference(page: import('@playwright/test').Page) {
	const { expect } = await import('@playwright/test');
	await page.evaluate(() => {
		const host = (window as unknown as { harness: Record<string, unknown> }).harness;
		host.gameImageRead = async () => {
			throw new Error('Unreadable fixture image');
		};
	});
	await page.getByText('Collect the key', { exact: true }).first().click();
	const error = page.getByText('Unable to read this checkpoint image.', { exact: true });
	await expect(error).toBeVisible();
	await page.getByRole('button', { name: 'Remove image reference', exact: true }).click();
	await expect(error, 'removing a reference clears the stale read error').toHaveCount(0);
	await page.evaluate((png) => {
		const host = (window as unknown as { harness: Record<string, unknown> }).harness;
		host.gameImageRead = async () => 'data:image/png;base64,' + png;
	}, tiny);
}
