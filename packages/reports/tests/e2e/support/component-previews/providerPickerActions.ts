import { expect, type Locator } from '@playwright/test';

/** Reach and verify each picker state through its public controls and client. */
export async function prepareProviderPickerState(component: Locator, variant: string) {
	if (variant === 'loading')
		return expect(component.getByRole('status')).toHaveText('Waiting for picker state…');
	if (variant === 'connection-error') {
		await expect(component.getByRole('alert')).toHaveText('Preview request rejected.');
		return expect(component.getByRole('status')).toHaveText('No picker state received.');
	}
	await expect(component.getByText(/Local preview: not connected to Codex/)).toBeVisible();
	if (variant === 'unbound') {
		await expect(component.getByLabel('Session ID')).toBeVisible();
		return expect(component.getByRole('button', { name: 'Queue switch' })).toBeDisabled();
	}
	if (variant === 'unobserved')
		return expect(component.getByText('Unknown', { exact: true })).toBeVisible();
	if (variant === 'control-unavailable')
		return expect(
			component.getByText('Desktop control is unavailable; the request stays pending.')
		).toBeVisible();
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
	if (variant === 'queue-empty' || variant === 'queue-populated') {
		await component.getByRole('button', { name: 'Show queued sessions' }).click();
		return expect(
			component.getByText(
				variant === 'queue-empty'
					? 'No queued sessions.'
					: /Claude Opus 5.5 · xhigh effort · pending/
			)
		).toBeVisible();
	}
	if (variant === 'cancelled') {
		await component.getByRole('button', { name: 'Cancel pending switch' }).click();
		return expect(component.getByText('Nothing is queued for this session.')).toBeVisible();
	}
	const status = variant === 'request-cancelled' ? 'cancelled' : variant;
	if (['applying', 'applied', 'failed', 'cancelled'].includes(status))
		return expect(component.locator('.picker-request')).toHaveAttribute('data-status', status);
	await expect(component.getByText('GPT 6.1', { exact: true })).toBeVisible();
	await expect(component.getByText('Claude Opus 5.5', { exact: true })).toBeVisible();
}
