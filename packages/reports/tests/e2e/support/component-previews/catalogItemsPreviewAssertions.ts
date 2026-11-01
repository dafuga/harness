import { expect, type Locator } from '@playwright/test';

/** Use the real pagination and config value controls for their opened examples. */
export async function prepareCatalogItems(component: Locator, variant: string) {
	const more = component.getByRole('button', { name: 'View more Components' });
	if (variant === 'more' || variant === 'all') await more.click();
	if (variant === 'all') await more.click();
	if (variant === 'batch-focused') await more.focus();
	if (variant === 'batch-hovered') await more.hover();
	if (variant === 'configs-open')
		await component.getByRole('button', { name: 'View value for orderSettings.steps' }).click();
}

/** The catalog shows its real rows, pagination or variable table for the selected state. */
export async function assertCatalogItems(component: Locator, variant: string) {
	if (!variant) await expect(component.getByRole('article')).toHaveCount(1);
	if (variant === 'multiple') await expect(component.getByRole('article')).toHaveCount(3);
	await assertPagination(component, variant);
	if (variant === 'functions') await expect(component).toContainText('filterOrders');
	if (variant === 'pages')
		await expect(component.getByRole('img', { name: 'Screenshot of Orders page' })).toBeVisible();
	if (variant === 'unlinked') await expect(component).toContainText('Orders styles');
	if (['configs', 'configs-open', 'empty-configs'].includes(variant))
		await assertConfigItems(component, variant);
	if (variant === 'configs-open')
		await expect(
			component.getByRole('dialog', { name: 'orderSettings.steps · Value' })
		).toBeVisible();
}

async function assertConfigItems(component: Locator, variant: string) {
	await expect(component.getByRole('columnheader')).toHaveText(['Variable', 'Value']);
	const rows = component.locator('tbody tr');
	await expect(rows).toHaveCount(variant === 'empty-configs' ? 1 : 4);
	if (variant !== 'empty-configs') return;
	await expect(rows.getByRole('cell')).toHaveText('No rows to display.');
	await expect(rows.getByRole('cell')).toHaveAttribute('colspan', '2');
}

async function assertPagination(component: Locator, variant: string) {
	const counts: Record<string, number> = {
		batched: 1,
		more: 2,
		all: 3,
		'batch-focused': 1,
		'batch-hovered': 1
	};
	if (!counts[variant]) return;
	const more = component.getByRole('button', { name: 'View more Components' });
	await expect(component.getByRole('article')).toHaveCount(counts[variant]);
	if (variant === 'all') await expect(more).toHaveCount(0);
	else await expect(more).toBeVisible();
	if (variant === 'batch-focused')
		expect(await more.evaluate((button) => button.matches(':focus-visible'))).toBe(true);
	if (variant === 'batched') await expect(more).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	if (variant === 'batch-hovered') {
		expect(await more.evaluate((button) => button.matches(':hover'))).toBe(true);
		await expect(more, 'Hovered pagination paints its background').not.toHaveCSS(
			'background-color',
			'rgba(0, 0, 0, 0)'
		);
	}
}
