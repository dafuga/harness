import { expect, type Locator } from '@playwright/test';

/** A readonly attribute must also have a visible and non-focusable control treatment. */
export async function assertReadonlyGameFields(component: Locator, id: string, variant: string) {
	if (
		variant === 'readonly' &&
		['desktop.component.game-checkpoint-editor', 'desktop.component.game-checkpoint-pane'].includes(
			id
		)
	) {
		await assertReadonlyCheckpointFields(component);
		return;
	}
	if (id !== 'desktop.component.game-view-fields' || variant !== 'readonly') return;
	for (const name of ['View title', 'Art direction']) {
		const field = component.getByRole('textbox', { name, exact: true });
		await expect(field, 'Read-only view fields are visibly disabled').toBeDisabled();
		await expect(field).toHaveAttribute('readonly', '');
		const treatment = await field.evaluate((node) => ({
			opacity: Number(getComputedStyle(node).opacity),
			cursor: getComputedStyle(node).cursor
		}));
		expect(treatment.opacity, 'Read-only fields share the muted control treatment').toBeLessThan(1);
		expect(treatment.cursor).toBe('not-allowed');
	}
	await expect(component.getByRole('combobox', { name: 'Dimension', exact: true })).toBeDisabled();
	await expect(component.getByText('Read-only view settings', { exact: true })).toBeVisible();
	await expect(component.getByRole('combobox', { name: 'View', exact: true })).toBeEnabled();
}

async function assertReadonlyCheckpointFields(component: Locator) {
	const fields = component.locator('input:visible, textarea:visible, select:visible');
	expect(await fields.count()).toBeGreaterThan(0);
	for (const field of await fields.all()) {
		await expect(field, 'Readonly checkpoint fields are non-focusable').toBeDisabled();
		const treatment = await field.evaluate((node) => ({
			opacity: Number(getComputedStyle(node).opacity),
			cursor: getComputedStyle(node).cursor
		}));
		expect(treatment.opacity, 'Readonly checkpoint fields use the muted treatment').toBeLessThan(1);
		expect(treatment.cursor).toBe('not-allowed');
	}
}
