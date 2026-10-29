import { expect, type Locator } from '@playwright/test';

type CatalogStateAction = (component: Locator) => Promise<void>;

const actions: Record<string, CatalogStateAction> = {
	'reports.component.audio-comparison-viewer:before': async (component) => {
		await component.getByRole('button', { name: 'View before recording' }).click();
		await expect(component.getByRole('group', { name: 'Before recording' })).toBeVisible();
	},
	'reports.component.audio-comparison-viewer:after': async (component) => {
		await component.getByRole('button', { name: 'View after recording' }).click();
		await expect(component.getByRole('group', { name: 'After recording' })).toBeVisible();
	},
	'reports.component.audio-evidence:notes': async (component) => {
		await component.locator('.audio-details summary').click();
		await expect(
			component.getByText('Timing and diction were reviewed before approval.', { exact: true })
		).toBeVisible();
	}
};

/** Reproduce catalog variants that are reached through the component's own controls. */
export async function prepareCatalogState(component: Locator, id: string, variant: string) {
	const action = actions[`${id}:${variant}`];
	if (action) await action(component);
}
