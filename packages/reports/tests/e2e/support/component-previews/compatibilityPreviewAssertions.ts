import { expect, type Locator } from '@playwright/test';

export async function prepareCompatibilityState(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.remote-approval' || !['read', 'write'].includes(variant)) return;
	await component.getByRole('checkbox').first().check();
	await component.getByRole('combobox', { name: 'Device access' }).selectOption(variant);
}

export async function assertCompatibilityPreview(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.agent-controls') await controls(component, variant);
	if (id !== 'desktop.component.remote-approval') return;
	if (variant === 'no-projects')
		await expect(component).toContainText('Add a local project first.');
	if (['read', 'write'].includes(variant)) {
		await expect(component.getByRole('combobox', { name: 'Device access' })).toHaveValue(variant);
		await expect(component.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
	} else
		await expect(component.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
	if (variant === 'busy')
		await expect(component.getByRole('button', { name: 'Deny', exact: true })).toBeDisabled();
}

async function controls(component: Locator, variant: string) {
	if (variant === 'compact') {
		await expect(component.locator('.agent-icons')).toBeVisible();
		await expect(component.getByRole('combobox')).toHaveCount(0);
		return;
	}
	await expect(component.getByRole('combobox', { name: 'Model', exact: true })).toHaveCount(1);
	if (variant === 'empty') await expect(component).toContainText('No agent provider available.');
	if (['empty', 'unavailable'].includes(variant))
		await expect(component.getByRole('combobox', { name: 'Model', exact: true })).toBeDisabled();
}
