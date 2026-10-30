import { expect, type Locator } from '@playwright/test';

/** Provenance and value forms must remain identifiable in their own catalog captures. */
export async function assertContractExampleState(component: Locator, variant: string) {
	const labels: Record<string, string> = {
		illustrative: 'Illustrative example',
		missing: 'Example not recorded',
		'no-description': 'No description recorded.',
		structure: 'Full example as JSON',
		'structure-open': 'Full example as JSON',
		rows: 'Full example as JSON',
		markup: '<button>Save order</button>',
		multiple: 'Declared examples'
	};
	if (labels[variant])
		await expect(component.getByText(labels[variant], { exact: false })).toBeVisible();
	if (variant === 'rows')
		await expect(component.getByText('A-1047', { exact: true })).toBeVisible();
	if (variant === 'multiple') await expect(component.locator('.examples > ul > li')).toHaveCount(2);
}
