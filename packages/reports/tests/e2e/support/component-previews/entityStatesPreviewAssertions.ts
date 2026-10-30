import { expect, type Locator } from '@playwright/test';

/** Reach the viewport and image viewer through the gallery's real controls. */
export async function prepareEntityStates(component: Locator, variant: string) {
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
	if (variant === 'viewport-mobile')
		await expect(component.locator('.state-heading small').first()).toHaveText('390 × 844');
	if (variant === 'viewer-open') await expect(component.getByRole('dialog')).toBeVisible();
}
