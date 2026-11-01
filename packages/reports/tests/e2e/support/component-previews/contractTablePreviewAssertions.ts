import { expect, type Locator } from '@playwright/test';
import {
	assertContractTypeColor,
	assertMobileContractFields
} from './entityContractPreviewAssertions';

/** Show keyboard focus or pointer hover on the real example control. */
export async function prepareContractTableState(component: Locator, variant: string) {
	if (!['focused', 'hovered'].includes(variant)) return;
	const button = component.getByRole('button', { name: 'View example for seconds' });
	if (variant === 'hovered') await button.hover();
	else {
		await button.focus();
		await expect.poll(() => button.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
	}
}

/** Empty, labelled and long tables preserve their layout and example controls. */
export async function assertContractTableState(
	component: Locator,
	variant: string,
	viewport: string
) {
	if (!variant) await assertContractTypeColor(component);
	if (['empty', 'empty-kept', 'plain-empty'].includes(variant))
		await expect(component.getByText('No inputs', { exact: true })).toBeVisible();
	if (variant === 'plain') await expect(component.locator('.label')).toHaveText('Inputs');
	if (variant === 'hide-names')
		await expect(component.locator('thead th').first()).toHaveText('Type');
	if (variant === 'illustrative') await expect(component.getByText('Illustrative')).toBeVisible();
	if (variant === 'missing') {
		await expect(component.getByText('Example not recorded')).toBeVisible();
		await expect(component.getByRole('rowheader', { name: 'orderStore' })).toBeVisible();
	}
	await assertLongTable(component, variant);
	if (viewport === 'mobile') await assertMobileContractFields(component);
}

async function assertLongTable(component: Locator, variant: string) {
	if (variant === 'long')
		await expect(component.getByText('OrderStore.find.customerAccountIdentifier')).toBeVisible();
	if (variant === 'multiple') await expect(component.locator('tbody tr')).toHaveCount(2);
	if (['long', 'multiple'].includes(variant)) await assertExampleButtonsFit(component);
}

/** Long values must not push example controls outside the visible table frame. */
async function assertExampleButtonsFit(component: Locator) {
	const clipped = await component.locator('.frame').evaluate((frame) => {
		const bounds = frame.getBoundingClientRect();
		return Array.from(frame.querySelectorAll<HTMLButtonElement>('button.info'))
			.filter((button) => {
				const buttonBounds = button.getBoundingClientRect();
				return buttonBounds.left < bounds.left || buttonBounds.right > bounds.right;
			})
			.map((button) => button.getAttribute('aria-label'));
	});
	expect(clipped, 'Example buttons fit inside the visible table frame').toEqual([]);
}
