import { expect, type Locator } from '@playwright/test';

/** Exercise the plugin link's keyboard and pointer presentations. */
export async function prepareModuleState(component: Locator, variant: string) {
	const link = component.getByRole('link', { name: 'Email', exact: true });
	if (variant === 'link-focused') await link.focus();
	if (variant === 'link-hovered') await link.hover();
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
	if (['link-focused', 'link-hovered'].includes(variant)) {
		const link = component.getByRole('link', { name: 'Email', exact: true });
		const selector = variant === 'link-focused' ? ':focus-visible' : ':hover';
		expect(await link.evaluate((node, state) => node.matches(state), selector)).toBe(true);
	}
}
