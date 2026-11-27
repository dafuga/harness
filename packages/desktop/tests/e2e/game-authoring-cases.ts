import { expect, type Page } from '../../../../test/support/browserTest';
import { captureGame as capture, viewSettings, closeViewSettings } from './game-unsaved-fixture';
import { fakeProject } from './ui-workspace-fixture';

export async function checkProjectCreation(page: Page) {
	const { exampleDocument } = await import('../../../game/src/utils/game-authoring/keyDoor');
	await fakeProject(page);
	await page.addInitScript(
		({ document, id }) => {
			const host = (window as unknown as { harness: Record<string, unknown> }).harness;
			const original = host.snapshot as (input: unknown) => Promise<Record<string, unknown>>;
			host.gameCreate = async (input: unknown) => {
				localStorage.setItem('game-create-request', JSON.stringify(input));
				const snapshot = await original({ branch: null, commit: null });
				return {
					...snapshot,
					project: { name: 'created-game', root: '/fixture', id, kind: 'game', dimension: '3d' }
				};
			};
			host.selectProject = async () => ({
				project: { name: 'created-game', id, kind: 'game', dimension: '3d' }
			});
			host.gameRead = async () => ({ document, revision: 'a'.repeat(64) });
		},
		{ document: exampleDocument('3d'), id: 'local-' + 'a'.repeat(64) }
	);
	await page.goto('/');
	await expect(page.getByRole('form', { name: 'New project' })).toHaveCount(0);
	await page.getByRole('button', { name: 'New project', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'New project' })).toBeVisible();
	await expect(page.getByLabel('Project type', { exact: true })).toHaveValue('app');
	await page.getByLabel('Project type', { exact: true }).selectOption('game');
	await page.getByLabel('Dimension', { exact: true }).selectOption('3d');
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill('created-game');
	await capture(page, 'game-project-creation');
	await page.getByRole('button', { name: 'Create project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('game-create-request')!))
	).toEqual({ name: 'created-game', kind: 'game', dimension: '3d' });
	await viewSettings(page);
	await expect(page.getByLabel('Dimension', { exact: true })).toHaveValue('3d');
	await closeViewSettings(page);
}

export async function checkCheckpointFocus(page: Page) {
	await page.addInitScript(() => {
		const held: FrameRequestCallback[] = [];
		const original = window.requestAnimationFrame.bind(window);
		let holding = false;
		window.requestAnimationFrame = (callback) => {
			if (!holding) return original(callback);
			held.push(callback);
			return held.length;
		};
		Object.assign(window, {
			holdFrames: () => (holding = true),
			releaseFrames: () => {
				holding = false;
				for (const callback of held.splice(0)) callback(performance.now());
			}
		});
	});
	await page.goto('/game');
	await page.evaluate(() => (window as unknown as { holdFrames(): void }).holdFrames());
	await page.getByRole('button', { name: 'Add checkpoint', exact: true }).click();
	const title = page.getByLabel('Checkpoint title', { exact: true });
	await title.selectText();
	// The pane's first-field focus is scheduled for the next frame; it runs between the title being
	// chosen and selected and the author's text arriving, as it does between a fill's focus and its input.
	await page.evaluate(() => (window as unknown as { releaseFrames(): void }).releaseFrames());
	await page.keyboard.insertText('After the garden');
	await expect(title, 'text typed after choosing the title lands in the title').toHaveValue(
		'After the garden'
	);
}
