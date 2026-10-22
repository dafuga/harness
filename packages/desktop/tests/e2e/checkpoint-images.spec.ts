import { expect, test } from '../../../../test/support/browserTest';
import { projectId, setup, imageFailureAndLateResults } from './checkpoint-image-fixture';

test('checkpoint image generation persists with the graph and history stays read-only', async ({
	page
}) => {
	await setup(page);
	const prompt = page.getByLabel('Describe your checkpoint', { exact: true });
	await expect(page.getByRole('button', { name: 'Generate image', exact: true })).toBeVisible();
	await prompt.fill('A brass key in a lush garden');
	await page.getByRole('button', { name: 'Generate image', exact: true }).click();
	await expect(
		page.getByRole('img', { name: 'New checkpoint image for Collect the key', exact: true })
	).toBeVisible();
	expect(
		await page.evaluate(() => (window as unknown as { __imageCalls: number }).__imageCalls)
	).toBe(1);
	await page.getByRole('button', { name: 'Use this image', exact: true }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	const reference = page.getByRole('img', {
		name: 'Collect the key gameplay reference',
		exact: true
	});
	await expect(reference).toBeVisible();
	await expect(prompt).toHaveValue('A brass key in a lush garden');
	const reads = () =>
		page.evaluate(() => (window as unknown as { __imageReads: number }).__imageReads);
	const opened = await reads();
	await prompt.pressSequentially(' at dusk');
	await page.getByLabel('Checkpoint title', { exact: true }).pressSequentially('!');
	await page.getByLabel('Checkpoint title', { exact: true }).press('Backspace');
	await expect(reference).toBeVisible();
	expect(await reads(), 'editing a checkpoint keeps its image without reading it again').toBe(
		opened
	);
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((i) => i.decode()));
		});
		await page.screenshot({ path: 'test-results/checkpoint-image-after.png', fullPage: true });
	}
	await page.getByRole('button', { name: 'Done', exact: true }).click();
	await page.goto('/game?projectId=' + projectId + '&commit=' + 'a'.repeat(40));
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await expect(reference).toBeVisible();
	await expect(page.getByRole('button', { name: 'Generate image', exact: true })).toBeDisabled();
});

test('generation errors preserve the graph and late results never attach to another checkpoint', async ({
	page
}) => {
	await setup(page);
	await imageFailureAndLateResults(page);
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
	if (process.env.CHECKPOINT_GAME_TRANSITIONS === '1') {
		if (process.env.TAKE_SCREENSHOT === 'true') {
			await page.evaluate(() => document.fonts.ready);
			await page.screenshot({
				path: 'test-results/checkpoint-view-transition.png',
				fullPage: true
			});
		}
		await expect(
			page.getByRole('heading', { name: 'Second chamber', exact: true }),
			'checkpoint transitions must enter the target view'
		).toBeVisible();
		await expect(
			page.getByRole('img', { name: 'Collect the key gameplay reference', exact: true })
		).toHaveCount(0);
		await page.getByRole('button', { name: 'Move right', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'The courtyard', exact: true })).toBeVisible();
	}
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
