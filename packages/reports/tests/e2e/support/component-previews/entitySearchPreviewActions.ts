import { expect, type Locator } from '@playwright/test';

/** Open the real dialog and use its own keyboard interaction to reach each search state. */
export async function prepareEntitySearchState(component: Locator, variant: string) {
	await component.getByRole('button', { name: 'Search entities', exact: true }).click();
	const dialog = component.getByRole('dialog', { name: 'Search project' });
	await expect(dialog).toBeVisible();
	const field = dialog.getByRole('combobox', { name: 'Search entities' });
	if (!['open-initial', 'open-pinned'].includes(variant))
		await field.fill(variant === 'open-no-matches' ? 'billing' : 'order');
	if (variant === 'open-second-selected') await field.press('ArrowDown');
}

/** Assert the visible result, unavailable reading or pinned revision before capture. */
export async function assertEntitySearchState(
	component: Locator,
	variant: string,
	viewport: string
) {
	if (!variant) {
		await expect(component.getByRole('button', { name: 'Search entities' })).toBeVisible();
		await expect(component.getByRole('dialog')).toHaveCount(0);
		return;
	}
	const dialog = component.getByRole('dialog', { name: 'Search project' });
	const field = dialog.getByRole('combobox', { name: 'Search entities' });
	if (variant === 'open-initial') {
		await expect(field).toHaveValue('');
		const keys = dialog.getByText('Esc', { exact: true });
		if (viewport === 'mobile') await expect(keys).toBeHidden();
		else await expect(keys).toBeVisible();
	} else if (variant === 'open-loading') {
		await expect(field).toHaveAttribute('placeholder', 'Loading entities…');
		await expect(dialog.getByRole('status')).toHaveText('Loading entities…');
	} else if (variant === 'open-no-matches') {
		await expect(dialog.getByRole('status')).toHaveText('No entity matches “billing”');
	} else if (variant === 'open-pinned') {
		await expect(field).toHaveAttribute('placeholder', 'Search at 7561ee4');
		await expect(dialog.getByText('Commit 7561ee4')).toBeVisible();
	} else {
		await expect(field).toHaveValue('order');
		const option = dialog.getByRole('option').nth(variant === 'open-second-selected' ? 1 : 0);
		await expect(option).toHaveAttribute('aria-selected', 'true');
	}
}
