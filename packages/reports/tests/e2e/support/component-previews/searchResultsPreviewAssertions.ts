import { expect, type Locator } from '@playwright/test';

/** The list and status match the selected fixture, including touch-only guidance. */
export async function assertSearchResultsState(
	component: Locator,
	variant: string,
	viewport: string
) {
	if (variant === 'initial') {
		await expect(component.getByText('Type a name or a purpose', { exact: false })).toBeVisible();
		const keys = component.getByText('Esc', { exact: true });
		if (viewport === 'mobile') {
			expect(await component.page().evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(
				true
			);
			await expect(keys).toBeHidden();
		} else await expect(keys).toBeVisible();
		return;
	}
	if (variant === 'loading') {
		await expect(component.getByRole('status')).toHaveText('Loading entities…');
		return;
	}
	if (variant === 'no-matches') {
		await expect(component.getByRole('status')).toHaveText('No entity matches “billing”');
		return;
	}
	const options = component.getByRole('option');
	await expect(options.first()).toContainText('Orders page');
	if (variant === 'no-purpose')
		await expect(component.locator('.entity-search-purpose')).toHaveCount(0);
	const active = variant === 'none-selected' ? -1 : variant === 'second-selected' ? 1 : 0;
	await expect(component.getByRole('option', { selected: true })).toHaveCount(active < 0 ? 0 : 1);
	if (active >= 0) await expect(options.nth(active)).toHaveAttribute('aria-selected', 'true');
}
