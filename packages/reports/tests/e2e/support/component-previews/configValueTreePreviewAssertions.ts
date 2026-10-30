import { expect, type Locator } from '@playwright/test';

/** Open nested collections through their own disclosure controls. */
export async function prepareConfigValueTree(component: Locator, variant: string) {
	if (variant === 'expanded') await component.locator('summary').first().click();
	if (variant === 'expanded' || variant === 'object-expanded')
		await component.locator('summary').filter({ hasText: 'flags' }).click();
}

/** Preserve exact source and counts while showing each tree presentation. */
export async function assertConfigValueTree(component: Locator, variant: string) {
	const text: Record<string, string> = {
		'': '2 items',
		expanded: '"Pack"',
		object: '2 attributes',
		'object-expanded': 'false',
		'empty-array': '0 items',
		'empty-object': '0 attributes',
		'unknown-array': 'deliverySteps',
		'schema-array': 'Array schema',
		expression: 'process.env.REPORT_ORIGIN',
		'long-expression': 'z.strictObject'
	};
	await expect(component).toContainText(text[variant]);
	if (variant === 'expanded') await expect(component.locator('details[open]')).toHaveCount(2);
	if (variant === 'object-expanded')
		await expect(component.locator('details[open]')).toHaveCount(1);
	if (variant.startsWith('empty-'))
		await expect(component.locator('.ex-value-entries')).toHaveCount(0);
}
