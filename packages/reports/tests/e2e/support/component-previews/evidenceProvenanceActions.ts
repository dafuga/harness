import { expect, type Locator } from '@playwright/test';

const variantCounts: Record<string, number> = { single: 1, extended: 4 };

/** Assert each provenance list and the absence message before capturing it. */
export async function prepareEvidenceProvenance(component: Locator, variant: string) {
	if (variant === 'empty' || variant === 'absent') {
		await expect(component.getByText('No provenance recorded.', { exact: true })).toBeVisible();
		return;
	}
	const count = variantCounts[variant] ?? 2;
	await expect(component.locator('dl dt')).toHaveCount(count);
	await expect(component.locator('dl dd')).toHaveCount(count);
	if (variant === 'duplicate-labels')
		await expect(component.locator('dl dt')).toHaveText(['Source', 'Source']);
	if (variant === 'long') await expect(component).toContainText('Checkout confirmation captured');
}
