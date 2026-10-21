import {
	expect,
	test,
	type Page,
	type ElectronApplication
} from '../../../../test/support/browserTest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { capture, launch, imageProvider, recordRuntime } from './game-native-fixture';
import { nativeImageFixture } from './native-image-fixture';
import type { GameDocument } from '../../../game/src/models/Game.types';
test.setTimeout(120_000);
async function create(page: Page, name: string, dimension: string) {
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeVisible();
	await page.getByLabel('Project type', { exact: true }).selectOption('game');
	await page.getByLabel('Dimension', { exact: true }).selectOption(dimension);
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
	await capture(page, `${dimension}-creation`);
	await page.getByRole('button', { name: 'Create project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
	await expect(page.getByLabel('Dimension', { exact: true })).toHaveValue(dimension);
	await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
}
async function author(page: Page) {
	await page.getByLabel('View title', { exact: true }).fill('Authored courtyard');
	await page.getByRole('button', { name: 'New view', exact: true }).click();
	await page.getByLabel('View title', { exact: true }).fill('Second view');
	await page.getByLabel('View', { exact: true }).selectOption('courtyard');
	await page.getByRole('button', { name: 'Mechanics', exact: true }).click();
	await page.getByRole('textbox', { name: 'Title', exact: true }).first().fill('Authored movement');
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByRole('button', { name: 'Add checkpoint', exact: true }).click();
	await page.getByLabel('Checkpoint title', { exact: true }).fill('After the garden');
	await page.getByLabel('Prerequisites', { exact: true }).fill('garden');
	await page.getByLabel('Prerequisites', { exact: true }).press('Tab');
	await page.getByRole('button', { name: 'Add condition', exact: true }).click();
	await page.getByLabel('Condition 1 field', { exact: true }).fill('doorOpen');
	await page.getByLabel('Condition 1 field', { exact: true }).press('Tab');
	await page.getByRole('button', { name: 'Add action', exact: true }).click();
	await page.getByLabel('Action 1 target', { exact: true }).fill('authored');
	await page.getByLabel('Action 1 target', { exact: true }).press('Tab');
	await page.getByRole('button', { name: 'Fit View', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().scrollIntoViewIfNeeded();
	await capture(page, 'fit-graph');
	await expect(page.getByText('Collect the key', { exact: true }).first()).toBeInViewport({
		ratio: 1
	});
	await page.getByText('Collect the key', { exact: true }).first().click();
	await page
		.getByLabel('Checkpoint image direction', { exact: true })
		.fill('A golden key beside the courtyard explorer');
	await page.getByRole('button', { name: 'Generate checkpoint image', exact: true }).click();
	await expect(
		page.getByRole('img', { name: 'Collect the key gameplay reference', exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
}
async function persisted(page: Page, root: string, dimension: string) {
	const doc = JSON.parse(await readFile(join(root, 'game.json'), 'utf8')) as GameDocument;
	expect(doc.views.map((view) => view.title)).toEqual(['Authored courtyard', 'Second view']);
	expect(doc.mechanics[0].title).toBe('Authored movement');
	expect(doc.views[0].checkpoints.at(-1)).toMatchObject({
		requires: ['garden'],
		conditions: [{ field: 'doorOpen', value: true }],
		actions: [{ target: 'authored', value: true }]
	});
	const path = doc.views[0].checkpoints[0].image!.path;
	expect(await readFile(join(root, path))).toEqual(nativeImageFixture());
	await capture(page, `${dimension}-saved`);
	const started = performance.now();
	await page.reload();
	await expect(page.locator('canvas[data-ready="true"]').first()).toBeVisible();
	await recordRuntime(page, started, dimension);
	await expect(page.getByLabel('View title', { exact: true })).toHaveValue('Authored courtyard');
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await expect(
		page.getByRole('img', { name: 'Collect the key gameplay reference', exact: true })
	).toBeVisible();
	await capture(page, `${dimension}-reopened`);
}
async function play(page: Page, dimension: string) {
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(page.locator('canvas[data-ready="true"]').first()).toBeVisible();
	await expect(page.getByRole('button', { name: /Start AI/ })).toBeDisabled();
	await page.getByRole('button', { name: 'Move right', exact: true }).click({ clickCount: 4 });
	await page.getByRole('button', { name: 'Garden', exact: true }).click();
	await expect(page.getByText('Reached the garden', { exact: true })).toBeVisible();
	await capture(page, `${dimension}-play`);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await page.getByLabel('Checkpoint title', { exact: true }).fill('Collected key');
	await expect(page.locator('[data-harness-component=game-graph] header')).toContainText(
		'3 of 5 checkpoints complete'
	);
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(page.getByText('Reached the garden', { exact: true })).toBeVisible();
}
async function history(page: Page, root: string) {
	execFileSync('git', ['add', '.'], { cwd: root });
	execFileSync('git', ['commit', '-m', 'feat: save authored game'], { cwd: root });
	const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	const url = new URL(page.url());
	url.searchParams.set('commit', commit);
	url.searchParams.set('readonly', '1');
	await page.goto(url.href);
	await expect(page.getByLabel('View title', { exact: true })).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Checkpoints', exact: true }).click();
	await page.getByText('Collect the key', { exact: true }).first().click();
	await expect(
		page.getByRole('img', { name: 'Collect the key gameplay reference', exact: true })
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Regenerate checkpoint image', exact: true })
	).toBeDisabled();
	await page.getByRole('link', { name: 'Back to project', exact: true }).click();
	await expect(
		page.getByRole('navigation', { name: 'Catalog categories', exact: true })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Game Views', exact: true })).toBeVisible();
}
for (const { dimension, viewport } of ['2d', '3d'].flatMap((dimension) =>
	[
		{ name: 'desktop', width: 1440, height: 900 },
		{ name: 'tablet', width: 920, height: 1180 },
		{ name: 'mobile', width: 390, height: 844 }
	].map((viewport) => ({ dimension, viewport }))
))
	test(`native ${dimension} ${viewport.name} project creates authors generates saves reopens and plays`, async ({
		browserErrors
	}) => {
		const profile = await mkdtemp(join(tmpdir(), 'harness-game-profile-'));
		const name = 'harness-e2e-game-' + dimension + '-' + Date.now();
		const root = join(homedir(), 'projects', name);
		let app: ElectronApplication | undefined;
		try {
			app = await test.step('Launch real native host', () => launch(profile));
			browserErrors.watch(app.context());
			const page = await app.firstWindow();
			await page.setViewportSize(viewport);
			await test.step('Create a game', () => create(page, name, dimension));
			await imageProvider(root);
			await test.step('Author rules and image', () => author(page));
			await persisted(page, root, dimension);
			await play(page, dimension);
			await history(page, root);
		} finally {
			await app?.close();
			await rm(profile, { recursive: true, force: true });
			await rm(root, { recursive: true, force: true });
		}
	});
