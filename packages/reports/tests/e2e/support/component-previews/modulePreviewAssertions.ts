import { expect, type Locator } from '@playwright/test';

/** Exercise plugin and breadcrumb links with the keyboard and pointer. */
export async function prepareModuleState(component: Locator, variant: string) {
	if (!variant.includes('link-')) return;
	const link = moduleLink(component, variant);
	if (variant.endsWith('focused')) await link.focus();
	if (variant.endsWith('hovered')) await link.hover();
}

function moduleLink(component: Locator, variant: string) {
	const area = variant.startsWith('resource-')
		? component.getByRole('navigation', { name: 'Breadcrumb' })
		: component;
	return area.getByRole('link', { name: 'Email', exact: true });
}

/** The selected module or resource states their actual availability at the revision. */
export async function assertModuleState(component: Locator, variant: string) {
	const words: Record<string, string> = {
		'empty-generated': 'Nothing generated yet.',
		unavailable: 'Offline is not installed at this revision.',
		'not-found': 'not found',
		unindexed: 'catalog was indexed',
		'missing-id': 'No resource type is named in this address.',
		'detail-email': 'harness plugin generate email email',
		'detail-offline': 'harness plugin add offline',
		'project-module': 'Defined by this project',
		empty: 'No plugins are defined at this revision.',
		gaps: 'One module declaration is unavailable at this revision.',
		'detail-unindexed': 'No plugin catalog was indexed'
	};
	if (words[variant]) await expect(component).toContainText(words[variant]);
	if (variant.includes('link-')) {
		const link = moduleLink(component, variant);
		const selector = variant.endsWith('focused') ? ':focus-visible' : ':hover';
		expect(await link.evaluate((node, state) => node.matches(state), selector)).toBe(true);
	}
}
