import { expect, type Locator } from '@playwright/test';

/** Each card branch retains its real name, destination and own visual evidence. */
export async function assertModuleCardPreview(component: Locator, variant: string) {
	if (['missing', 'page-missing'].includes(variant)) {
		await expect(component.getByText('No screenshot is recorded at this revision')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (variant === 'image-error') {
		await expect(component.getByText('Screenshot could not be loaded.')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (['function', 'unlinked'].includes(variant)) {
		await expect(component.locator('.ex-function-call')).toBeVisible();
		await expect(component.locator('img')).toHaveCount(0);
	}
	if (variant === 'unlinked') {
		await expect(component.locator('span.ex-function-call')).toHaveText('Orders styles');
		await expect(component.locator('a.ex-function-call')).toHaveCount(0);
	}
	if (variant === 'page') {
		await expect(component.locator('a.ex-page-open img')).toHaveAttribute(
			'src',
			'/media/synthetic-orders-page-input.svg'
		);
	}
	if (variant === 'api') {
		await expect(component.locator('.ex-function-call')).toContainText(
			'GET POST DELETE /api/orders'
		);
		await expect(component.getByRole('group', { name: 'Used In' })).toContainText('OrderStore');
	}
	if (variant === 'api-no-methods')
		await expect(component.locator('.ex-function-call')).toHaveText('/api/orders');
	if (variant === 'no-usage')
		await expect(component.getByRole('group', { name: 'Used In' })).toContainText('—');
	if (variant === 'many-usage') {
		const usage = component.getByRole('group', { name: 'Used In' });
		await expect(usage.getByRole('link')).toHaveCount(3);
		await expect(usage.locator('.ex-usage-more')).toContainText('1 more usage');
		await expect(usage).not.toContainText('OrderCard');
	}
}
