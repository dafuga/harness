import { expect, type Locator } from '@playwright/test';

/** Reach filtered dependency lists through the screen's own search input. */
export async function prepareDependencies(component: Locator, variant: string) {
	if (variant === 'filtered' || variant === 'no-matches')
		await component
			.getByRole('searchbox', { name: 'Search dependencies' })
			.fill(variant === 'filtered' ? 'serde' : 'no-matching-package');
}

/** Distinguish missing data, empty declarations, partial reads and search results. */
export async function assertDependenciesState(component: Locator, variant: string) {
	const words: Record<string, string> = {
		unindexed: 'No dependency record was indexed',
		empty: 'No dependencies are declared',
		partial: 'Some manifests could not be read',
		unreadable: 'No declarations could be read',
		filtered: 'serde',
		'no-matches': 'No dependencies match this search.'
	};
	if (words[variant]) await expect(component).toContainText(words[variant]);
	if (variant === 'partial' || variant === 'unreadable')
		await expect(component.getByRole('note')).toContainText('packages/legacy/package.json');
	if (variant === 'filtered') await expect(component.locator('tbody tr')).toHaveCount(1);
	if (variant === 'no-matches')
		await expect(component.getByRole('button', { name: 'Clear search' })).toBeVisible();
}
