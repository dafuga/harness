import {
	keepEdits,
	keepTypedFields,
	viewSettings,
	doneCheckpoint,
	advancedCheckpoint,
	captureCheckpointViewports,
	captureGame as capture
} from './game-unsaved-fixture';
import { expect, test } from '../../../../test/support/browserTest';
import { fakeProject } from './ui-workspace-fixture';
import * as level from './game-level-fixture';
if (process.env.TAKE_SCREENSHOT === 'true') test.use({ video: 'on' });
test('game authoring exposes independent mechanics and executable checkpoint graph', async ({
	page
}) => {
	test.setTimeout(180_000);
	await level.exerciseLevelPlanning(page, capture);
	await captureCheckpointViewports(page, capture);
	await page.getByRole('button', { name: 'Mechanics', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
		'Movement and collision'
	);
});
for (const dimension of ['2d', '3d'])
	test(dimension + ' preview executes key-door branching without AI', async ({ page }) => {
		await page.goto('/game');
		await viewSettings(page);
		await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
		await page.getByLabel('Dimension', { exact: true }).selectOption(dimension);
		await doneCheckpoint(page);
		await page.getByRole('button', { name: 'Preview', exact: true }).click();
		await expect(page.locator('canvas[data-ready="true"]').first()).toBeVisible();
		await page.getByRole('button', { name: 'Move right', exact: true }).click({ clickCount: 4 });
		await page.getByRole('button', { name: 'Garden', exact: true }).click();
		await expect(page.getByText('Reached the garden', { exact: true })).toBeVisible();
		await capture(page, 'game-preview-' + dimension);
		await doneCheckpoint(page);
		await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
		await page.getByText('Collect the key', { exact: true }).first().click();
		await page.getByLabel('Checkpoint title', { exact: true }).fill('Collected key');
		await expect(page.locator('[data-harness-component=game-graph] header')).toContainText(
			'3 of 4 checkpoints complete'
		);
		await capture(page, 'game-progress-preserved-' + dimension);
		await doneCheckpoint(page);
		await page.getByRole('button', { name: 'Preview', exact: true }).click();
		await expect(page.getByRole('button', { name: /Start AI/ })).toBeDisabled();
	});
test('saved graph edits persist, invalid references block saves and history is read-only', async ({
	page
}) => {
	const { exampleDocument } = await import('../../../game/src/utils/game-authoring/keyDoor');
	await page.addInitScript(
		({ document }) => {
			let revision = 'a'.repeat(64);
			Object.assign(window, {
				harness: {
					gameRead: async () => ({
						document: JSON.parse(
							localStorage.getItem('game-test-document') || JSON.stringify(document)
						),
						revision
					}),
					gameSave: async (input: { document: unknown; expectedRevision: string }) => {
						if (input.expectedRevision !== revision)
							throw new Error('The game changed. Reload before saving.');
						localStorage.setItem('game-test-document', JSON.stringify(input.document));
						revision = 'b'.repeat(64);
						return { revision };
					}
				}
			});
		},
		{ document: exampleDocument(), projectId: 'local-' + 'a'.repeat(64) }
	);
	const url = '/game?projectId=local-' + 'a'.repeat(64);
	await page.goto(url);
	await viewSettings(page);
	await page.getByLabel('View title', { exact: true }).fill('Saved courtyard');
	await keepEdits(page);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
	await page.reload();
	await viewSettings(page);
	await expect(page.getByLabel('View title', { exact: true })).toHaveValue('Saved courtyard');
	await keepTypedFields(page, () =>
		page.evaluate(() => JSON.parse(localStorage.getItem('game-test-document') ?? 'null'))
	);
	await doneCheckpoint(page);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await advancedCheckpoint(page);
	await page.getByLabel('Prerequisites', { exact: true }).fill('missing-node');
	await page.getByLabel('Prerequisites', { exact: true }).press('Tab');
	await expect(page.getByRole('alert')).toContainText('Unknown checkpoint: missing-node');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
	page.once('dialog', (dialog) => dialog.accept());
	await page.goto(url + '&readonly=1&commit=' + 'c'.repeat(40));
	await expect(page.getByLabel('View title', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
	await doneCheckpoint(page);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Add checkpoint', exact: true })).toHaveCount(0);
});
test('view creation and checkpoint creation/deletion preserve independent mechanics', async ({
	page
}) => {
	await level.installLevelProject(page);
	await page.goto(level.levelProject);
	await viewSettings(page);
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	const trace = page.getByText(/^Execution trace/);
	for (let step = 0; step < 2; step++)
		await page.getByRole('button', { name: 'Move right' }).click();
	await page.getByRole('button', { name: 'New level', exact: true }).click();
	await expect(page.getByLabel('View title', { exact: true })).toHaveValue('New level');
	await level.buildLevel(page);
	await doneCheckpoint(page);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await expect(trace, 'a newly built level has an independent trace').toHaveText(
		'Execution trace (0)'
	);
	await page.getByRole('button', { name: 'Add checkpoint', exact: true }).click();
	await expect(page.getByLabel('Checkpoint title', { exact: true })).toHaveValue('Checkpoint 1');
	await page.getByRole('button', { name: 'Delete checkpoint', exact: true }).click();
	await expect(page.getByText('Checkpoint 1', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Mechanics', exact: true }).click();
	await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Independent movement');
	await doneCheckpoint(page);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await expect(page.getByText('Checkpoint 1', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Mechanics', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
		'Independent movement'
	);
	await page.getByLabel('View', { exact: true }).selectOption({ label: 'The courtyard' });
	await doneCheckpoint(page);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await expect(page.getByText('Collect the key', { exact: true }).first()).toBeVisible();
	await expect(trace).toHaveText('Execution trace (1)');
	await trace.click();
	await expect(
		page.getByRole('list', { name: 'Checkpoint execution trace' }).getByRole('listitem')
	).toHaveText([/^Collect the key · tick 2/]);
});
test('3D remains playable when the browser cannot provide WebGL', async ({ page }) => {
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			kind: string,
			options?: unknown
		) {
			if (kind === 'webgl2') return null;
			return Reflect.apply(original, this, [kind, options]);
		} as typeof original;
	});
	await page.goto('/game');
	await viewSettings(page);
	await page.getByLabel('Dimension', { exact: true }).selectOption('3d');
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(page.locator('canvas[data-renderer="software3d"][data-ready="true"]')).toBeVisible();
	await page.getByRole('button', { name: 'Move right', exact: true }).click({ clickCount: 4 });
	await page.getByRole('button', { name: 'Vault', exact: true }).click();
	await expect(page.getByText('Reached the vault', { exact: true })).toBeVisible();
	await capture(page, 'game-preview-3d-software');
});
test('project creation sends the chosen game type and dimension', async ({ page }) => {
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
	await expect(page.getByLabel('Dimension', { exact: true })).toHaveValue('3d');
});
test('held arrow keys animate the 3D game through the vault branch', async ({ page }) => {
	await page.goto('/game');
	await viewSettings(page);
	await page.getByLabel('Dimension', { exact: true }).selectOption('3d');
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(page.locator('canvas[data-ready="true"]')).toBeVisible();
	await page.locator('canvas').click();
	await page.keyboard.down('ArrowRight');
	await expect(page.getByText('Door open', { exact: true })).toBeVisible();
	await page.keyboard.up('ArrowRight');
	await page.getByRole('button', { name: 'Vault', exact: true }).click();
	await expect(page.getByText('Reached the vault', { exact: true })).toBeVisible();
	await capture(page, 'game-keyboard-playthrough');
});
