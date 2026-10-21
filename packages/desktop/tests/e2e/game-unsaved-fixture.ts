import { expect, type Page } from '../../../../test/support/browserTest';

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
