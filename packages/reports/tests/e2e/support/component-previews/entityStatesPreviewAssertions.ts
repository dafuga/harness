import { expect, type Locator } from '@playwright/test';

/** Reach the viewport and image viewer through the gallery's real controls. */
export async function prepareEntityStates(component: Locator, variant: string) {
	if (variant === 'image-error') {
		const button = component.locator('.state-card .image-button').first();
		await expect(button).toBeDisabled();
		await expect(button).toContainText('Image unavailable');
	}
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
	if (variant === 'capture-details-open') {
		const details = component.locator('.state-card details.card-body').first();
		await details.locator('summary').click();
		await expect(details).toHaveAttribute('open', '');
	}
	if (variant === 'viewer-open') {
		await component.locator('.state-card .image-button').nth(1).click();
		const viewer = component.getByRole('dialog');
		await expect(viewer.getByRole('heading', { name: 'Default · After' })).toBeVisible();
		await expect(
			viewer.getByRole('button', { name: 'View after screenshot', exact: true })
		).toHaveClass(/active/);
		await expect(viewer.locator('figcaption')).toBeInViewport({ ratio: 1 });
	}
}

/** Each gallery capture keeps its declared absence, comparison or image state visible. */
export async function assertEntityStates(component: Locator, variant: string) {
	const words: Record<string, string> = {
		empty: 'No visual states are declared',
		current: 'Current',
		initial: 'This is the first commit of its history',
		missing: 'No capture of',
		rejected: 'not usable',
		inapplicable: 'Inapplicable:',
		'coverage-gap': 'The team has not specified capture coverage.',
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
