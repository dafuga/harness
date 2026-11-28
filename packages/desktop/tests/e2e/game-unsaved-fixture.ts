export { captureGame } from './game-capture-fixture';
import { expect, type Locator, type Page } from '../../../../test/support/browserTest';
import type { GameDocument } from '../../../game/src/models/game-authoring/Game.types';

/** A canceled app navigation or reload retains the authoring document. */
export async function keepEdits(page: Page) {
	const address = page.url();
	await viewSettings(page);
	const title = page.getByLabel('View title', { exact: true });
	const value = await title.inputValue();
	await closeViewSettings(page);
	const confirmed = page.waitForEvent('dialog', { timeout: 2000 });
	const leaving = page.getByRole('link', { name: 'Back to project', exact: true }).click();
	const confirmation = await confirmed;
	expect(confirmation.type()).toBe('confirm');
	await confirmation.dismiss();
	await leaving;
	await expect(page).toHaveURL(address);
	await viewSettings(page);
	await expect(title).toHaveValue(value);
	await closeViewSettings(page);
	const unloading = page.waitForEvent('dialog', { timeout: 2000 });
	const reload = page.reload({ timeout: 2000 }).catch(() => undefined);
	const prompt = await unloading;
	expect(prompt.type()).toBe('beforeunload');
	await prompt.dismiss();
	await reload;
	await expect(page).toHaveURL(address);
	await viewSettings(page);
	await expect(title).toHaveValue(value);
	await closeViewSettings(page);
	await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
}

/** Scenario id of a guard state; the bare unit id is its default presentation. */
export function guardState(name: 'default' | 'unsaved') {
	return name === 'default'
		? 'desktop-component-game-navigation-guard'
		: 'desktop-component-game-navigation-guard-' + name;
}

/** A clean game has no unsaved edits, so its guard is inactive and leaving needs no confirmation. */
export async function leaveCleanGame(page: Page) {
	await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
	const address = page.url();
	await page.evaluate(() => {
		window.confirm = (message) => {
			document.documentElement.dataset.gameConfirmation = message;
			return true;
		};
	});
	await page.getByRole('link', { name: 'Back to project', exact: true }).click();
	await expect(
		page.getByRole('navigation', { name: 'Catalog categories', exact: true })
	).toBeVisible();
	await expect(page).not.toHaveURL(address);
	await expect(page.locator('html')).not.toHaveAttribute('data-game-confirmation');
	await page.getByRole('link', { name: 'Game Views', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Game Views', exact: true })).toBeVisible();
}

/** Native app navigation uses a controlled confirm; host unload is checked by startup tests and native UI. */
export async function keepNativeNavigation(page: Page) {
	const address = page.url();
	await viewSettings(page);
	const title = page.getByLabel('View title', { exact: true });
	const saved = await title.inputValue();
	await closeViewSettings(page);
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
	await viewSettings(page);
	await expect(title).toHaveValue(saved);
	await closeViewSettings(page);
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

const settingsDialog = (page: Page) =>
	page.getByRole('dialog', { name: 'View settings', exact: true });

/** The title, dimension and art direction wait in the View settings dialog until it is opened. */
export async function viewSettings(page: Page) {
	if (!(await settingsDialog(page).isVisible()))
		await page.getByRole('button', { name: 'View settings', exact: true }).click();
	await expect(settingsDialog(page)).toBeVisible();
}

/** The dialog is modal: close it before using the page behind it (tabs, Save, Preview). */
export async function closeViewSettings(page: Page) {
	if (await settingsDialog(page).isVisible())
		await settingsDialog(page).getByRole('button', { name: 'Close viewer', exact: true }).click();
	await expect(settingsDialog(page)).toBeHidden();
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
