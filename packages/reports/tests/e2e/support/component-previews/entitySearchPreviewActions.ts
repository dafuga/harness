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

/** Retain the screenshot before rejecting an extra focus indicator inside the field frame. */
export async function assertEntitySearchCapture(component: Locator, id: string, variant: string) {
	if (id !== 'reports.component.entity-search' || !variant) return;
	const dialog = component.getByRole('dialog', { name: 'Search project' });
	const field = dialog.getByRole('combobox', { name: 'Search entities' });
	await expect(field).toBeFocused();
	const indicators = await field.evaluate((node) => {
		const style = getComputedStyle(node);
		return {
			outline: parseFloat(style.outlineWidth),
			border: parseFloat(style.borderTopWidth),
			shadow: style.boxShadow
		};
	});
	expect(indicators, 'Search frame owns the single aligned focus indicator').toEqual({
		outline: 0,
		border: 0,
		shadow: 'none'
	});
	const frame = dialog.locator('.entity-search-field');
	await expect(frame).toHaveCSS('outline-style', 'solid');
	expect(
		await frame.evaluate((node) => parseFloat(getComputedStyle(node).outlineWidth))
	).toBeGreaterThan(0);
	await expect(dialog.locator('.entity-search-note').first()).toHaveText(
		variant === 'open-pinned' ? 'Commit 7561ee4' : 'Orders'
	);
}
