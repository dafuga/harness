import { captureLevelPlayback } from './game-level-playback-capture';
import type { Page } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { installLevelProject, levelProject, buildLevel } from './game-level-fixture';
import { viewSettings } from './game-unsaved-fixture';

async function newLevel(page: Page) {
	await installLevelProject(page);
	await page.goto(levelProject);
	await viewSettings(page);
	await page.getByRole('button', { name: 'New level', exact: true }).click();
}
async function describe(page: Page) {
	await page.getByLabel('Concept', { exact: true }).fill('A lantern island');
	await page.getByRole('button', { name: 'Continue to level brief', exact: true }).click();
	await page
		.getByLabel('Level brief', { exact: true })
		.fill('A small island with a wall and a lantern.');
}
for (const dimension of ['2d', '3d'])
	for (const [width, height] of [
		[1440, 900],
		[920, 1180],
		[390, 844]
	])
		test(
			dimension +
				' at ' +
				width +
				' planned level starts at spawn, respects walls and resets with touch controls',
			async ({ page }) => {
				await page.setViewportSize({ width, height });
				await newLevel(page);
				await buildLevel(page, dimension);
				await page.getByRole('button', { name: 'Preview', exact: true }).click();
				const controls = page.locator('[data-harness-component=game-controls]');
				await expect(controls).toContainText('x 1.00 · y 1.00');
				await expect(controls.getByRole('button', { name: 'Garden', exact: true })).toHaveCount(0);
				await expect(controls.getByRole('button', { name: 'Vault', exact: true })).toHaveCount(0);
				await controls
					.getByRole('button', { name: 'Move down', exact: true })
					.click({ clickCount: 3 });
				await controls
					.getByRole('button', { name: 'Move right', exact: true })
					.click({ clickCount: 4 });
				await expect(controls).toContainText('x 4.00 · y 4.00');
				await controls
					.getByRole('button', { name: 'Move up', exact: true })
					.click({ clickCount: 3 });
				await controls
					.getByRole('button', { name: 'Move right', exact: true })
					.click({ clickCount: 3 });
				await expect(controls).toContainText('x 7.00 · y 1.00');
				await controls.getByRole('button', { name: 'Reset', exact: true }).click();
				await expect(controls).toContainText('x 1.00 · y 1.00');
				await captureLevelPlayback(page, dimension);
			}
		);
test('generation failures retain the brief and never approve or build a level', async ({
	page
}) => {
	await newLevel(page);
	await describe(page);
	await page.evaluate(() => {
		Reflect.get(window, 'harness').gameLevelGenerate = async () => {
			throw Error('Provider quota unavailable');
		};
	});
	await page.getByRole('button', { name: 'Generate level', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Provider quota unavailable');
	await expect(page.getByLabel('Level brief', { exact: true })).toHaveValue(
		'A small island with a wall and a lantern.'
	);
	await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Approve level', exact: true })).toHaveCount(0);
});
test('regeneration carries requested changes and requires approval again', async ({ page }) => {
	await newLevel(page);
	await describe(page);
	await page.getByRole('button', { name: 'Generate level', exact: true }).click();
	await page.getByRole('button', { name: 'Approve level', exact: true }).click();
	await page.getByLabel('Requested changes', { exact: true }).fill('Add another stone wall.');
	await page.evaluate(() => {
		const bridge = Reflect.get(window, 'harness'),
			original = bridge.gameLevelGenerate;
		bridge.gameLevelGenerate = async (input: unknown) => {
			localStorage.setItem('level-regeneration', JSON.stringify(input));
			return original(input);
		};
	});
	await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Approve level', exact: true })).toBeEnabled();
	await expect(page.getByRole('button', { name: 'Build level', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
	const request = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('level-regeneration') ?? 'null')
	);
	expect(request.feedback).toBe('Add another stone wall.');
	expect(request.document.views.at(-1).planning).not.toHaveProperty('built');
	await expect(page.getByRole('alert')).toHaveCount(0);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	const saved = await page.evaluate(() =>
		JSON.parse(localStorage.getItem('level-document') ?? 'null')
	);
	expect(saved.views.at(-1).planning.proposal.id).toBe('2'.padStart(64, '0'));
	expect(saved.views.at(-1).planning).not.toHaveProperty('approved');
});
test('a changed brief rejects a late model response', async ({ page }) => {
	await newLevel(page);
	await describe(page);
	await page.evaluate(() => {
		const bridge = Reflect.get(window, 'harness'),
			original = bridge.gameLevelGenerate;
		bridge.gameLevelGenerate = (input: unknown) =>
			new Promise((resolve) => {
				Reflect.set(window, 'deliverLevel', async () => resolve(await original(input)));
			});
	});
	await page.getByRole('button', { name: 'Generate level', exact: true }).click();
	await page.getByLabel('Level brief', { exact: true }).fill('A newer description for the island.');
	await page.evaluate(() => Reflect.get(window, 'deliverLevel')());
	await expect(page.getByRole('alert')).toHaveText(
		'The level changed while generating, so that result was set aside.'
	);
	await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Approve level', exact: true })).toHaveCount(0);
});
