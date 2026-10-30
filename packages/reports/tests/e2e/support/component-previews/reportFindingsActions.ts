import { expect, type Locator } from '@playwright/test';

/** Assert the actual findings and links represented by each catalog state. */
export async function prepareReportFindings(component: Locator, variant: string) {
	if (variant === 'empty') {
		await expect(component.getByText('No findings recorded.', { exact: true })).toBeVisible();
		await expect(component.locator('article')).toHaveCount(0);
		return;
	}
	await expect(
		component.getByRole('heading', { name: 'Findings and remaining issues', exact: true })
	).toBeVisible();
	await expect(component.locator('article')).toHaveCount(variant === 'multiple' ? 2 : 1);
	if (variant === 'with-evidence' || variant === 'multiple')
		await expect(
			component.getByRole('link', { name: /Evidence checkout-confirmation/ })
		).toHaveAttribute('href', '#evidence-checkout-confirmation');
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(component.locator('article .badge')).toHaveClass(new RegExp(variant));
}
