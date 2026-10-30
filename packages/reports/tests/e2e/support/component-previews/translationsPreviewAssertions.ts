import { expect, type Locator } from '@playwright/test';

/** Reach the language, search, pagination and gap states through real controls. */
export async function prepareTranslations(component: Locator, variant: string) {
	if (variant === 'gaps-open') await component.locator('.ex-translations-gaps summary').click();
	if (variant === 'search' || variant === 'no-matches')
		await component
			.getByRole('searchbox', { name: 'Search translations' })
			.fill(variant === 'search' ? 'Écouter' : 'no-such-translation');
	if (variant === 'german')
		await component.getByRole('combobox', { name: 'Language' }).selectOption('de');
	if (variant === 'more') await component.getByRole('button', { name: 'View More' }).click();
}

/** Each catalog state states what was recorded and what the selected language contains. */
export async function assertTranslations(component: Locator, variant: string) {
	if (variant === 'unindexed')
		await expect(component).toContainText('No translation catalog is recorded');
	if (variant === 'empty' || variant === 'no-matches')
		await expect(component).toContainText('No translations match this search.');
	if (variant === 'gaps' || variant === 'gaps-open')
		await expect(component.locator('.ex-translations-gaps summary')).toContainText(
			'Some translation sources could not be read'
		);
	if (variant === 'gaps-open')
		await expect(component).toContainText('packages/orders/fr.json is unavailable');
	if (variant === 'search') await expect(component.locator('tbody tr')).toHaveCount(1);
	if (variant === 'german')
		await expect(component.getByRole('columnheader', { name: 'German' })).toBeVisible();
	if (variant === 'more') await expect(component.locator('tbody tr')).toHaveCount(100);
	if (variant === 'missing-values') {
		await expect(component).toContainText('Not translated');
		await expect(component).toContainText('Empty string');
		await expect(component.getByRole('link', { name: 'OrderList' })).toBeVisible();
	}
}
