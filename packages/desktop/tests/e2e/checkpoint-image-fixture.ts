import { readFile } from 'node:fs/promises';
import { exampleDocument } from '../../../game/src/utils/keyDoor';
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
