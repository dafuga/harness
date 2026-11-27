import { expect, type Locator } from '@playwright/test';
import { preparePickerOperation, preparePickerQueue } from './providerPickerOperationActions';

/** Reach and verify each picker state through its public controls and client. */
export async function prepareProviderPickerState(component: Locator, variant: string) {
	if (variant === 'loading')
		return expect(component.getByRole('status')).toHaveText('Waiting for picker state…');
	if (variant === 'connection-error') {
		await expect(component.getByRole('alert')).toHaveText('Preview request rejected.');
		return expect(component.getByRole('status')).toHaveText('No picker state received.');
	}
	await expect(component.getByText(/Local preview: not connected to Codex/)).toBeVisible();
	if (await preparePickerOperation(component, variant)) return;
	if (await preparePickerQueue(component, variant)) return;
	if (await assertPickerAvailability(component, variant)) return;
	await assertPickerRequest(component, variant);
}

async function assertPickerAvailability(component: Locator, variant: string): Promise<boolean> {
	if (variant === 'unbound') {
		await expect(component.getByLabel('Session ID')).toBeVisible();
		await expect(component.getByRole('button', { name: 'Queue switch' })).toBeDisabled();
		return true;
	}
	if (variant === 'unobserved') {
		await expect(component.getByText('Unknown', { exact: true })).toBeVisible();
		return true;
	}
	if (variant === 'in-use') {
		await expect(component.getByText(/In use · clients: 2/)).toBeVisible();
		return true;
	}
	if (variant === 'no-models') {
		await expect(component.getByText('This selection is not in the catalog.')).toBeVisible();
		await expect(component.getByRole('button', { name: 'Queue switch' })).toBeDisabled();
		return true;
	}
	if (variant === 'control-unavailable') {
		await expect(
			component.getByText('Desktop control is unavailable; the request stays pending.')
		).toBeVisible();
		return true;
	}
	return false;
}

async function assertPickerRequest(component: Locator, variant: string) {
	if (variant === 'refreshing') {
		await component.getByRole('button', { name: 'Refresh', exact: true }).click();
		await expect(component.getByText('Refreshing…')).toBeVisible();
		return expect(component.getByRole('button', { name: 'Queue switch' })).toBeDisabled();
	}
	if (variant === 'provider-claude') {
		await component.getByRole('combobox', { name: 'Provider' }).selectOption('harness-claude');
		await expect(component.getByRole('combobox', { name: 'Model' })).toHaveValue('claude-opus-5-5');
		return expect(component.getByRole('combobox', { name: 'Reasoning effort' })).toHaveValue(
			'xhigh'
		);
	}
	if (variant === 'cancelled') {
		await component.getByRole('button', { name: 'Cancel pending switch' }).click();
		return expect(component.getByText('Nothing is queued for this session.')).toBeVisible();
	}
	const status = variant === 'request-cancelled' ? 'cancelled' : variant;
	if (['applying', 'applied', 'failed', 'cancelled'].includes(status))
		return expect(component.locator('.picker-request')).toHaveAttribute('data-status', status);
	await expect(
		component.locator('.picker-active').getByText('GPT 6.1', { exact: true })
	).toBeVisible();
	await expect(
		component.locator('.picker-request').getByText('Claude Opus 5.5', { exact: true })
	).toBeVisible();
}
