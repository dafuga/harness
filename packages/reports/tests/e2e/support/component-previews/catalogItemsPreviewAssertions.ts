import { expect, type Locator } from '@playwright/test';

/** Use the real pagination and config value controls for their opened examples. */
export async function prepareCatalogItems(component: Locator, variant: string) {
	if (variant === 'more')
		await component.getByRole('button', { name: 'View more Components' }).click();
	if (variant === 'configs-open')
		await component.getByRole('button', { name: 'View value for orderSettings.steps' }).click();
}

/** The catalog shows its real rows, pagination or variable table for the selected state. */
export async function assertCatalogItems(component: Locator, variant: string) {
	if (!variant) await expect(component.getByRole('article')).toHaveCount(1);
	if (variant === 'multiple') await expect(component.getByRole('article')).toHaveCount(3);
	if (variant === 'batched' || variant === 'more') {
		await expect(component.getByRole('article')).toHaveCount(variant === 'more' ? 2 : 1);
		await expect(component.getByRole('button', { name: 'View more Components' })).toBeVisible();
	}
	if (variant === 'functions') await expect(component).toContainText('filterOrders');
	if (variant === 'pages')
		await expect(component.getByRole('img', { name: 'Screenshot of Orders page' })).toBeVisible();
	if (variant === 'unlinked') await expect(component).toContainText('Orders styles');
	if (variant === 'configs' || variant === 'configs-open' || variant === 'empty-configs') {
		await expect(component.getByRole('columnheader')).toHaveText(['Variable', 'Value']);
		await expect(component.locator('tbody tr')).toHaveCount(variant === 'empty-configs' ? 0 : 4);
	}
	if (variant === 'configs-open')
		await expect(
			component.getByRole('dialog', { name: 'orderSettings.steps · Value' })
		).toBeVisible();
}
