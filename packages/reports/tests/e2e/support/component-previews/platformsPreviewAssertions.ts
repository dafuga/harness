import { expect, type Locator } from '@playwright/test';

/** Apply search and status filters through the platform screen's real controls. */
export async function preparePlatforms(component: Locator, variant: string) {
	if (variant === 'search' || variant === 'no-matches')
		await component
			.getByRole('searchbox', { name: 'Search platforms' })
			.fill(variant === 'search' ? 'iPhone' : 'no-such-platform');
	if (variant !== 'filter-open' && !variant.startsWith('status-')) return;
	await component.getByRole('button', { name: 'Filters', exact: true }).click();
	const dialog = component.getByRole('dialog', { name: 'Filters' });
	await expect(dialog).toBeVisible();
	if (variant.startsWith('status-')) {
		await dialog.getByRole('combobox', { name: 'Status filter' }).selectOption(variant.slice(7));
		await dialog.getByRole('button', { name: 'Done' }).click();
	}
}

/** Keep missing records, filters and the selected detail visibly distinct. */
export async function assertPlatforms(component: Locator, variant: string) {
	if (variant === 'gap')
		await expect(component).toContainText('Deployment manifest is unavailable');
	if (variant === 'unindexed' || variant === 'status-not-recorded')
		await expect(component).toContainText('Not recorded');
	if (variant === 'search') await expect(component.locator('.pf-card')).toHaveCount(1);
	if (variant === 'no-matches')
		await expect(component.getByRole('button', { name: 'Show all platforms' })).toBeVisible();
	if (variant === 'filter-open')
		await expect(component.getByRole('dialog', { name: 'Filters' })).toBeVisible();
	if (variant === 'status-configured') await expect(component.locator('.pf-card')).toHaveCount(2);
	if (variant === 'status-setup-required' || variant === 'status-not-configured')
		await expect(component.locator('.pf-card')).toHaveCount(1);
	if (variant === 'status-not-recorded') await expect(component.locator('.pf-card')).toHaveCount(4);
	if (variant === 'detail-web') await expect(component).toContainText('orders-web');
}
