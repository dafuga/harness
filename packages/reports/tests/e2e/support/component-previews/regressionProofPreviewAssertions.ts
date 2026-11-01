import { expect, type Locator } from '@playwright/test';

/** Incomplete records and an empty list cannot imply a proven regression. */
export async function assertRegressionProofState(component: Locator, variant: string) {
	await expect(component).not.toContainText(/Component Previews|Requires its own screenshot/);
	if (variant === 'pending')
		await expect(component).toContainText('Declined payment keeps the checkout error visible.');
	if (['gap', 'pending', 'capture-only'].includes(variant))
		await expect(component.locator('.footnote')).not.toContainText(
			'These results prove the regression.'
		);
	if (variant === 'capture-only')
		await expect(component).toContainText('No failing-test checkpoint is recorded.');
	if (variant === 'empty')
		await expect(
			component.getByText('No regression proof is available for this unit.')
		).toBeVisible();
}
