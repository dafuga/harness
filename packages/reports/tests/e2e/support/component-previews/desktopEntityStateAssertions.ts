import { expect, type Locator } from '@playwright/test';

export async function assertEntitySectionContent(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.entity-view') return;
	const sections: Record<string, string[]> = {
		apis: ['APIs', 'app.api.list-orders'],
		'used-in': ['Used In', 'app.layout.operations'],
		uses: ['Uses', 'app.component.order-list']
	};
	const section = sections[variant];
	if (section) {
		const region = component.getByRole('region', { name: section[0], exact: true });
		await expect(
			region.locator(`a[href*="${section[1]}"]`),
			'The selected entity section shows its recorded relationship'
		).toBeVisible();
	}
	if (variant === 'history')
		await expect(
			component.locator('.entity-main').getByText('Add order-status filters', { exact: true }),
			'The History tab shows a meaningful recorded change'
		).toBeVisible();
}

export async function assertEntityCategory(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.entity-view') return;
	const category = variant === 'helper-examples' ? 'functions' : 'pages';
	const text = await component.locator('.breadcrumb').innerText();
	expect(text, 'Entity breadcrumb category').toMatch(new RegExp(`^${category} ›`));
	if (!variant || variant === 'conversation-closed')
		await expect(component.getByRole('button', { name: 'Close conversation' })).toHaveCount(
			variant ? 0 : 1
		);
}
