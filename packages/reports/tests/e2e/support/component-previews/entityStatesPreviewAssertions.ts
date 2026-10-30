import { expect, type Locator } from '@playwright/test';

/** Reach the viewport and image viewer through the gallery's real controls. */
export async function prepareEntityStates(component: Locator, variant: string) {
	if (variant === 'scenario-selected')
		await component.getByRole('combobox', { name: 'Scenario' }).selectOption('archived-orders');
	if (variant === 'scenario-open' || variant === 'viewport-open') {
		const name = variant === 'scenario-open' ? 'Scenario' : 'Viewport';
		const select = component.getByRole('combobox', { name });
		const second = select.locator('option').nth(1);
		await expect(second).toHaveText(variant === 'scenario-open' ? 'Archived orders' : /Mobile/);
		await select.click();
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	}
	if (variant === 'viewport-mobile')
		await component.getByRole('combobox', { name: 'Viewport' }).selectOption('mobile');
	if (variant === 'viewer-open') {
		await component.locator('.state-card .image-button').first().click();
		await expect(component.getByRole('dialog')).toBeVisible();
	}
}

/** Each gallery capture keeps its declared absence, comparison or image state visible. */
export async function assertEntityStates(component: Locator, variant: string) {
	const words: Record<string, string> = {
		empty: 'No visual states are declared',
		current: 'Current',
		missing: 'No capture of',
		rejected: 'not usable',
		inapplicable: 'Inapplicable:',
		incomparable: 'Viewport sizes changed between these revisions.',
		'load-error': 'Recorded capture could not be loaded.'
	};
	if (words[variant])
		await expect(component.getByText(words[variant], { exact: false }).first()).toBeVisible();
	if (variant === 'loading')
		await expect(component.locator('.state-panes .state-gap').first()).toHaveText(
			'Loading recorded capture…'
		);
	if (variant === 'scenario-selected')
		await expect(component.getByRole('heading', { name: 'Archived', exact: true })).toBeVisible();
	if (variant === 'viewport-mobile')
		await expect(component.locator('.state-heading small').first()).toHaveText('390 × 844');
	if (variant === 'viewer-open') await expect(component.getByRole('dialog')).toBeVisible();
}
