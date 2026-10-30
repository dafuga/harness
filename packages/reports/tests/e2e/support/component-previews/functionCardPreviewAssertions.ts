import { expect, type Locator } from '@playwright/test';

/** The forwarding component keeps a nonvisual card and its actual consumer count. */
export async function assertFunctionCardState(component: Locator, variant: string) {
	const card = component.locator('[data-harness-component="explorer-ui-explorer-module-card"]');
	await expect(card).toBeVisible();
	await expect(card.locator('.ex-thumb img')).toHaveCount(0);
	if (variant === 'service') await expect(card).toContainText('OrderStore');
	if (variant === 'model') await expect(card).toContainText('Order');
	if (variant === 'no-usage')
		await expect(card.getByRole('group', { name: 'Used In' })).toContainText('—');
	if (variant === 'many-usage') {
		const usage = card.getByRole('group', { name: 'Used In' });
		await expect(usage.getByRole('link')).toHaveCount(3);
		await expect(usage.locator('.ex-usage-more')).toContainText('1 more usage');
	}
}
