import { expect, type Locator } from '@playwright/test';

/** The translation matrix exercises the shared selector and its three-column projection. */
export async function assertTranslationControls(component: Locator) {
	await expect(component.getByRole('combobox', { name: 'Language' })).toHaveValue('fr');
	await expect(component.getByRole('columnheader')).toHaveText(['English', 'French', 'Used In']);
	await expect(component.locator('tbody code, tbody small')).toHaveCount(0);
	await expect(component.getByRole('columnheader', { name: 'English', exact: true })).toBeVisible();
	await expect(component.getByRole('columnheader', { name: 'French', exact: true })).toBeAttached();
	await expect(component.locator('tbody tr')).toHaveCount(50);
	await component.getByRole('button', { name: 'View More' }).click();
	await expect(component.locator('tbody tr')).toHaveCount(100);
	await component.getByRole('searchbox', { name: 'Search translations' }).fill('Écouter');
	await expect(component.locator('tbody tr')).toHaveCount(1);
	await expect(component.locator('tbody')).toContainText('Listen and compare');
	await expect(component.locator('tbody')).toContainText('Écouter et comparer');
	await component.getByRole('combobox', { name: 'Language' }).selectOption('de');
	await expect(component.getByRole('columnheader')).toHaveText(['English', 'German', 'Used In']);
	await expect(component.locator('tbody')).toContainText('Anhören und vergleichen');
	await expect(component.locator('tbody')).not.toContainText('Écouter et comparer');
	await component.getByRole('combobox', { name: 'Language' }).selectOption('fr');
	await component
		.getByRole('searchbox', { name: 'Search translations' })
		.fill('no-such-translation');
	await expect(component.getByText('No translations match this search.')).toBeVisible();
	await component.getByRole('searchbox', { name: 'Search translations' }).clear();
	await expect(component.locator('tbody tr')).toHaveCount(50);
}
