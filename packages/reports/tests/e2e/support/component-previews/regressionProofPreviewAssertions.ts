import { expect, type Locator } from '@playwright/test';

/** Incomplete records and an empty list cannot imply a proven regression. */
export async function assertRegressionProofState(component: Locator, variant: string) {
	if (['gap', 'pending', 'capture-only'].includes(variant))
		await expect(component.locator('.footnote')).not.toContainText(
			'These results prove the regression.'
		);
	if (variant === 'capture-only')
		await expect(component).toContainText('No failing-test checkpoint is recorded.');
	if (variant === 'empty')
		await expect(
			component.getByText('No regression proof has been recorded for this unit.')
		).toBeVisible();
}
