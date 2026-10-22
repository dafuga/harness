import { expect, type Page } from '@playwright/test';
import { exampleDocument } from '../../../game/src/utils/game-authoring/keyDoor';

/** Saved-project image boundary, without paid provider calls or project credentials. */
export async function checkpointModal(
	page: Page,
	capture: (page: Page, name: string) => Promise<void>
) {
	await imageProject(page);
	await page.goto('/game?projectId=local-' + 'a'.repeat(64));
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await expect(page.getByText('Collect the key', { exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Add checkpoint', exact: true }).click();
	await capture(page, 'checkpoint-modal-' + (process.env.SCREENSHOT_LABEL ?? 'proof'));
	const modal = page.getByRole('dialog', { name: 'Add checkpoint', exact: true });
	await expect(modal).toBeVisible();
	await expect(modal.getByRole('group', { name: 'Condition 1' })).toHaveCount(0);
	await modal
		.getByRole('textbox', { name: 'Describe your checkpoint', exact: true })
		.fill('A moonlit bridge appears when the player collects the key.');
	await modal.getByRole('button', { name: 'Generate image', exact: true }).click();
	await expect(modal.getByRole('img', { name: /checkpoint/i })).toBeVisible();
	await capture(page, 'checkpoint-image-first-' + (process.env.SCREENSHOT_LABEL ?? 'proof'));
	await modal
		.getByRole('textbox', { name: 'Request changes', exact: true })
		.fill('Make the bridge mossy and add warm lanterns.');
	await modal.getByRole('button', { name: 'Generate changes', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('image-requests')!).length))
		.toBe(2);
	await expect(modal.getByRole('img', { name: /checkpoint/i })).toBeVisible();
	await capture(page, 'checkpoint-image-review-' + (process.env.SCREENSHOT_LABEL ?? 'proof'));
	await modal.getByRole('button', { name: 'Use this image', exact: true }).click();
	await expect(modal).toHaveCount(0);
	await expect(page.getByRole('region', { name: 'Checkpoint graph' })).toContainText(
		'of 5 checkpoints'
	);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('saved-checkpoints')!));
	const added = saved.views[0].checkpoints.at(-1);
	expect(added.description).toContain('moonlit bridge');
	expect(added.image.prompt).toContain('warm lanterns');
	await page.reload();
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Checkpoint graph' })).toContainText(
		'of 5 checkpoints'
	);
}

async function imageProject(page: Page) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#142844"/><stop offset="1" stop-color="#6b9c99"/></linearGradient></defs><rect width="960" height="540" fill="url(#sky)"/><circle cx="735" cy="100" r="46" fill="#f6e8b7"/><path d="M0 300L170 170 350 330 600 175 960 300V540H0" fill="#203f44"/><path d="M0 450Q480 250 960 430V500Q480 330 0 510" fill="#a39770"/><path d="M0 410Q480 220 960 390" fill="none" stroke="#d4c89d" stroke-width="16"/><path d="M0 490Q480 290 960 470" fill="none" stroke="#3f6755" stroke-width="18"/><circle cx="300" cy="345" r="14" fill="#ffd37b"/><circle cx="610" cy="330" r="14" fill="#ffd37b"/></svg>`;
	await page.addInitScript(
		({ document, picture }) => {
			let calls: unknown[] = [];
			Object.assign(window, {
				harness: {
					gameRead: async () => ({
						document: JSON.parse(
							localStorage.getItem('saved-checkpoints') || JSON.stringify(document)
						),
						revision: 'a'.repeat(64)
					}),
					gameSave: async (input: { document: unknown }) => {
						localStorage.setItem('saved-checkpoints', JSON.stringify(input.document));
						return { revision: 'a'.repeat(64) };
					},
					gameImageGenerate: async (input: { document: typeof document; checkpointId: string }) => {
						calls.push(input);
						localStorage.setItem('image-requests', JSON.stringify(calls));
						const node = input.document.views[0].checkpoints.find(
							(c) => c.id === input.checkpointId
						)!;
						return {
							image: {
								path: 'game-assets/' + String(calls.length).repeat(64) + '.png',
								model: 'gpt-image-2',
								createdAt: '2026-10-22T20:00:00.000Z',
								prompt: node.description + '\n' + node.imagePrompt
							},
							dataUrl: picture
						};
					},
					gameImageRead: async () => picture
				}
			});
		},
		{
			document: exampleDocument(),
			picture: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
		}
	);
}
