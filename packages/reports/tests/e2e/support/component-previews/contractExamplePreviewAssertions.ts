import { expect, type Locator } from '@playwright/test';
import { assertContractTypeColor } from './entityContractPreviewAssertions';

/** Provenance and value forms must remain identifiable in their own catalog captures. */
export async function assertContractExampleState(component: Locator, variant: string) {
	if (!variant) await assertContractTypeColor(component);
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
	if (variant === 'missing')
		await expect(component.getByText('The store that reads and updates orders.')).toBeVisible();
	if (variant === 'rows')
		await expect(component.getByText('A-1047', { exact: true })).toBeVisible();
	if (variant === 'multiple') await expect(component.locator('.examples > ul > li')).toHaveCount(2);
}
