import { expect, type Locator } from '@playwright/test';

/** Each example preserves its documented source and expected outcome. */
export async function assertUsageExamples(component: Locator, variant: string) {
	if (variant === 'empty') await expect(component).toContainText('No usage examples are recorded.');
	if (variant === 'setup' || variant === 'setup-only')
		await expect(component.getByRole('heading', { name: 'Prepare the duration' })).toBeVisible();
	if (variant === 'setup' || variant === 'inline-setup' || variant === 'setup-only')
		await expect(component).toContainText('const seconds = 90;');
	if (variant === 'multiple') await expect(component.locator('article')).toHaveCount(2);
	if (variant === 'missing-call') await expect(component).toContainText('// Call not documented');
	if (variant === 'error') await expect(component).toContainText('// throws');
	if (variant === 'void') await expect(component).toContainText('// => undefined');
}
