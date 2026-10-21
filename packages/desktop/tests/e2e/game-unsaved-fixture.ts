import { expect, type Locator, type Page } from '../../../../test/support/browserTest';
import type { GameDocument } from '../../../game/src/models/Game.types';

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
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(unsaved).toHaveCount(0);
}

/** Every authored text field, typed while focused, is kept, saved and reopened exactly as typed. */
export async function keepTypedFields(page: Page, stored: () => Promise<GameDocument>) {
	const tab = (name: string) => page.getByRole('button', { name, exact: true }).click();
	const pick = (title: string) => page.getByText(title, { exact: true }).first().click();
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
