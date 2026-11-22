import { expect, type Locator } from '@playwright/test';
import { platformNames, resetPlatformBoundary } from './platformVideoCheckpoint';

/** The compiled platforms route opens as the approved pilot checkpoint: empty search, every card, focus. */
export async function assertPlatformsRouteReady(component: Locator) {
	await expect(component.getByRole('heading', { name: 'Platforms', exact: true })).toBeVisible();
	const search = component.getByRole('searchbox', { name: 'Search platforms' });
	await expect(search).toHaveValue('');
	await expect(component.getByRole('link', { name: /^View .* configuration$/ })).toHaveCount(4);
	// Cards can render below the fold on narrow viewports.
	for (const name of platformNames)
		await expect(
			component.getByRole('link', { name: `View ${name} configuration`, exact: true })
		).toBeVisible();
	await resetPlatformBoundary(component.page());
}

/** Apply search and status filters through the platform screen's real controls. */
export async function preparePlatforms(component: Locator, variant: string) {
	await preparePlatformFocus(component, variant);
	if (variant === 'search' || variant === 'no-matches')
		await component
			.getByRole('searchbox', { name: 'Search platforms' })
			.fill(variant === 'search' ? 'iPhone' : 'no-such-platform');
	if (!['filter-open', 'filter-active-open'].includes(variant) && !variant.startsWith('status-'))
		return;
	await component.getByRole('button', { name: 'Filters', exact: true }).click();
	const dialog = component.getByRole('dialog', { name: 'Filters' });
	await expect(dialog).toBeVisible();
	if (variant === 'status-options-open') {
		const select = dialog.getByRole('combobox', { name: 'Status filter' });
		await select.click();
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	} else if (variant === 'filter-active-open') {
		await dialog.getByRole('combobox', { name: 'Status filter' }).selectOption('configured');
	} else if (variant.startsWith('status-')) {
		await dialog.getByRole('combobox', { name: 'Status filter' }).selectOption(variant.slice(7));
		await dialog.getByRole('button', { name: 'Done' }).click();
		await component.page().mouse.move(1, 1);
	}
}

async function preparePlatformFocus(component: Locator, variant: string) {
	if (variant === 'search-focused')
		await component.getByRole('searchbox', { name: 'Search platforms' }).focus();
	const card = component.getByRole('link', { name: 'View Web configuration' });
	if (variant === 'card-focused') await card.focus();
	if (variant === 'card-hovered') await card.hover();
}

/** Keep missing records, filters and the selected detail visibly distinct. */
export async function assertPlatforms(component: Locator, variant: string) {
	if (variant === 'gap')
		await expect(component).toContainText('Deployment manifest is unavailable');
	if (['unindexed', 'status-not-recorded'].includes(variant))
		await expect(component).toContainText('Not recorded');
	if (variant === 'search') await expect(component.locator('.pf-card')).toHaveCount(1);
	if (variant === 'no-matches')
		await expect(component.getByRole('button', { name: 'Show all platforms' })).toBeVisible();
	if (variant === 'filter-open')
		await expect(component.getByRole('dialog', { name: 'Filters' })).toBeVisible();
	await assertPlatformFilterResults(component, variant);
	if (variant === 'detail-web') await expect(component).toContainText('orders-web');
	await assertPlatformInteraction(component, variant);
}

async function assertPlatformFilterResults(component: Locator, variant: string) {
	if (variant === 'status-configured') await expect(component.locator('.pf-card')).toHaveCount(2);
	if (['status-setup-required', 'status-not-configured'].includes(variant))
		await expect(component.locator('.pf-card')).toHaveCount(1);
	if (variant === 'status-not-recorded') await expect(component.locator('.pf-card')).toHaveCount(4);
	if (variant.startsWith('status-') && variant !== 'status-options-open')
		await expect(component.locator('.pf-card:hover')).toHaveCount(0);
}

async function assertPlatformInteraction(component: Locator, variant: string) {
	if (variant === 'filter-active-open')
		await expect(component.getByRole('combobox', { name: 'Status filter' })).toHaveValue(
			'configured'
		);
	if (variant === 'status-options-open')
		expect(
			await component
				.getByRole('combobox', { name: 'Status filter' })
				.evaluate((node) => node.matches(':open'))
		).toBe(true);
	const focus =
		variant === 'search-focused'
			? component.getByRole('searchbox', { name: 'Search platforms' })
			: component.getByRole('link', { name: 'View Web configuration' });
	if (['search-focused', 'card-focused'].includes(variant))
		expect(await focus.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
	if (variant === 'card-hovered')
		expect(await focus.evaluate((node) => node.matches(':hover'))).toBe(true);
}
