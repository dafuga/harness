import { expect, type Locator } from '@playwright/test';

/** The selected module or resource states their actual availability at the revision. */
export async function assertModuleState(component: Locator, variant: string) {
	const words: Record<string, string> = {
		'empty-generated': 'Nothing generated yet.',
		unavailable: 'Offline is not installed at this revision.',
		'not-found': 'not found',
		unindexed: 'No module catalog was indexed',
		'missing-id': 'No resource type is named in this address.'
	};
	if (words[variant]) await expect(component).toContainText(words[variant]);
}
