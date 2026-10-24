import { expect, type Page } from '../../../../../test/support/browserTest';

/** The ordinary primitive matrix proves native values, group identity, styles and dialog focus. */
export async function exerciseNativeAtoms(page: Page): Promise<void> {
	const form = page.getByRole('form', { name: 'Native atom interactions' });
	const input = form.getByRole('textbox', { name: 'Name', exact: true });
	await expect(input).toHaveAttribute('data-atom-ready', 'true');
	const submit = form.getByRole('button', { name: 'Submit native form' });
	await expect(submit).toBeDisabled();
	await input.fill('Ada');
	await form.getByRole('spinbutton', { name: 'Count' }).fill('7');
	await form.getByRole('checkbox', { name: 'Enable submit' }).check();
	await form.getByRole('combobox', { name: 'Choice' }).selectOption('two');
	await form.getByRole('checkbox', { name: 'Group one' }).check();
	await form.getByRole('checkbox', { name: 'Group two' }).check();
	await form.getByRole('textbox', { name: 'Notes' }).fill('Bound without blur');
	await expect(submit).toHaveCSS('outline-style', 'solid');
	await submit.click();
	const values = form.getByRole('status', { name: 'Native values' });
	await expect
		.poll(async () => JSON.parse((await values.textContent())!))
		.toMatchObject({
			name: 'Ada',
			count: 7,
			enabled: true,
			choice: 'two',
			group: ['one', 'two'],
			notes: 'Bound without blur',
			submitted: 1
		});
	const open = form.getByRole('button', { name: 'Open native dialog' });
	await open.click();
	const dialog = page.getByRole('dialog', { name: 'Native dialog', exact: true });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Close native dialog' }).click();
	await expect(dialog).not.toBeVisible();
	await expect(open).toBeFocused();
	await expect.poll(async () => JSON.parse((await values.textContent())!).closed).toBe(true);
}
