import { expect, type Locator } from '@playwright/test';

/** Assert the selected section and its visible empty-data message before capture. */
export async function prepareCoverageList(component: Locator, variant: string) {
	const acceptance = !variant.includes('coverage');
	const coverage = !variant.includes('acceptance');
	if (variant.endsWith('empty')) {
		if (acceptance)
			await expect(component.getByText('No acceptance criteria recorded yet.')).toBeVisible();
		if (coverage) await expect(component.getByText('No coverage recorded yet.')).toBeVisible();
		return;
	}
	if (acceptance)
		await expect(
			component.getByText('The customer sees an order confirmation after checkout.')
		).toBeVisible();
	if (coverage) await expect(component.locator('.check').first()).toBeVisible();
}
