import { recordGameCapture } from './game-checkpoint-fixture';
import { recordLevelCapture } from './game-level-capture';
import { expect, type Locator, type Page } from '../../../../test/support/browserTest';
import type { GameDocument } from '../../../game/src/models/game-authoring/Game.types';

/** A canceled app navigation or reload retains the authoring document. */
export async function keepEdits(page: Page) {
	const address = page.url();
	const title = page.getByLabel('View title', { exact: true });
	const value = await title.inputValue();
	const confirmed = page.waitForEvent('dialog', { timeout: 2000 });
	const leaving = page.getByRole('link', { name: 'Back to project', exact: true }).click();
	const confirmation = await confirmed;
	expect(confirmation.type()).toBe('confirm');
	await confirmation.dismiss();
	await leaving;
	await expect(page).toHaveURL(address);
	await expect(title).toHaveValue(value);
	const unloading = page.waitForEvent('dialog', { timeout: 2000 });
	const reload = page.reload({ timeout: 2000 }).catch(() => undefined);
	const prompt = await unloading;
	expect(prompt.type()).toBe('beforeunload');
	await prompt.dismiss();
	await reload;
	await expect(page).toHaveURL(address);
	await expect(title).toHaveValue(value);
	await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
}

/** Native app navigation uses a controlled confirm; host unload is checked by startup tests and native UI. */
export async function keepNativeNavigation(page: Page) {
	const address = page.url();
	const title = page.getByLabel('View title', { exact: true });
	const saved = await title.inputValue();
	await page.evaluate(() => {
		window.confirm = (message) => {
			document.documentElement.dataset.gameConfirmation = message;
			return false;
		};
	});
	await page.getByRole('link', { name: 'Back to project', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute(
		'data-game-confirmation',
		'Discard unsaved game changes?'
	);
	await expect(page).toHaveURL(address);
	await expect(title).toHaveValue(saved);
	await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
}

/** Typing marks the game unsaved before the field is left, and a canceled reload keeps the text. */
async function typeAndKeep(page: Page, field: Locator, text: string) {
	const unsaved = page.getByText('Unsaved changes', { exact: true });
	await expect(unsaved).toHaveCount(0);
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.pressSequentially(text);
	await expect(field).toBeFocused();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		await page.screenshot({
			path: 'test-results/game-focused-' + text.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) + '.png',
			fullPage: true
		});
	}
	await expect(unsaved, `typing "${text}" must mark the game unsaved at once`).toBeVisible();
	const unloading = page.waitForEvent('dialog', { timeout: 2000 });
	const reload = page.reload({ timeout: 2000 }).catch(() => undefined);
	await (await unloading).dismiss();
	await reload;
	await expect(field).toHaveValue(text);
	const dialog = page.getByRole('dialog');
	const title = (await dialog.count())
		? await page.getByLabel('Checkpoint title', { exact: true }).inputValue()
		: null;
	await doneCheckpoint(page);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(unsaved).toHaveCount(0);
	if (title) await openCheckpoint(page, title);
}

/** Every authored text field, typed while focused, is kept, saved and reopened exactly as typed. */
export async function keepTypedFields(page: Page, stored: () => Promise<GameDocument>) {
	const tab = async (name: string) => {
		await doneCheckpoint(page);
		await page.getByRole('button', { name, exact: true }).click();
	};
	const pick = (title: string) => openCheckpoint(page, title);
	const stay = async () => undefined;
	const cases: [() => Promise<unknown>, string, string][] = [
		[() => pick('Collect the key'), 'Condition 1 field', 'steps'],
		[stay, 'Condition 1 value', '-2.5'],
		[stay, 'Action 1 target', 'hasSilverKey'],
		[stay, 'Action 1 value', 'false'],
		[stay, 'Action 2 value', 'east wing'],
		[() => pick('Enter the garden'), 'Prerequisites', 'door, key'],
		[() => tab('Mechanics'), 'Inputs', 'x, y, jump'],
		[stay, 'Events', 'key-collected, jumped']
	];
	await tab('Checkpoints');
	for (const [open, label, text] of cases) {
		await open();
		await typeAndKeep(page, page.getByLabel(label, { exact: true }), text);
	}
	const [key, , garden] = (await stored()).views[0].checkpoints;
	expect(key.conditions[0]).toEqual({ field: 'steps', op: 'gte', value: -2.5 });
	expect(key.actions.map(({ target, value }) => [target, value])).toEqual([
		['hasSilverKey', false],
		['key-collected', 'east wing']
	]);
	expect(garden.requires).toEqual(['door', 'key']);
	expect((await stored()).mechanics[0]).toMatchObject({
		inputs: ['x', 'y', 'jump'],
		events: ['key-collected', 'jumped']
	});
	await page.reload();
	await tab('Checkpoints');
	await pick('Collect the key');
	for (const [, label, text] of cases.slice(0, 5))
		await expect(page.getByLabel(label, { exact: true })).toHaveValue(text);
}

/** Scene controls are deliberately hidden until requested. */
export async function viewSettings(page: Page) {
	if (!(await page.getByLabel('View title', { exact: true }).isVisible()))
		await page.getByRole('button', { name: /View settings/ }).click();
}

export async function doneCheckpoint(page: Page) {
	const done = page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true });
	if (await done.isVisible()) await done.click();
}

export async function advancedCheckpoint(page: Page) {
	const advanced = page.getByRole('button', { name: 'Advanced rules', exact: true });
	if ((await advanced.getAttribute('aria-expanded')) !== 'true') await advanced.click();
}

export async function openCheckpoint(page: Page, title: string) {
	await doneCheckpoint(page);
	await page.getByText(title, { exact: true }).first().click();
	await advancedCheckpoint(page);
}

export async function captureGame(page: import('@playwright/test').Page, name: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true' && !process.env.HARNESS_EVIDENCE_DIR) return;
	await page.locator('h1').first().waitFor();
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	const path = 'test-results/' + name + '-' + page.viewportSize()?.width + '.png';
	const bytes = await page.screenshot({ path, fullPage: true });
	await recordGameCapture(page, name, bytes);
	await recordLevelCapture(page, name, bytes);
}

/** Compact creation, image review and optional rule editing at each scenario viewport. */
export async function captureCheckpointViewports(
	page: Page,
	capture: (page: Page, name: string) => Promise<void>
) {
	const { checkpointModal } = await import('./game-checkpoint-fixture');
	for (const [width, height] of [
		[1440, 900],
		[920, 1180],
		[390, 844]
	]) {
		await page.setViewportSize({ width, height });
		await checkpointModal(page, capture);
		await openCheckpoint(page, 'Collect the key');
		const condition = page.getByLabel('Condition 1 field', { exact: true });
		await condition.scrollIntoViewIfNeeded();
		await expect(condition).toBeInViewport();
		await capture(page, 'checkpoint-advanced-rules');
		await doneCheckpoint(page);
	}
}
