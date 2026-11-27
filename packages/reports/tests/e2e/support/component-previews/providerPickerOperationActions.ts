import { expect, type Locator } from '@playwright/test';

const buttonNames: Record<string, string> = {
	queueing: 'Queue switch',
	cancelling: 'Cancel pending switch'
};

/** Keep each pending operation visible until the capture has completed. */
export async function preparePickerOperation(component: Locator, variant: string) {
	if (!['bind-ready', 'binding', 'queueing', 'cancelling', 'loading-queue'].includes(variant))
		return false;
	if (variant === 'bind-ready' || variant === 'binding') {
		await component.getByLabel('Session ID').fill('preview-session');
		const button = component.getByRole('button', { name: 'Bind session' });
		await expect(button).toBeEnabled();
		if (variant === 'bind-ready') return true;
		await button.click();
	} else {
		const button = buttonNames[variant] ?? 'Show queued sessions';
		if (variant === 'queueing') {
			await component.getByRole('combobox', { name: 'Provider' }).selectOption('harness-claude');
			await expect(component.getByRole('combobox', { name: 'Model' })).toHaveValue(
				'claude-opus-5-5'
			);
		}
		await component.getByRole('button', { name: button }).click();
	}
	const label: Record<string, string> = {
		binding: 'Binding session…',
		queueing: 'Queueing switch…',
		cancelling: 'Cancelling…',
		'loading-queue': 'Loading queued sessions…'
	};
	await expect(component.getByText(label[variant], { exact: true })).toBeVisible();
	await expect(component.getByRole('button', { name: 'Queue switch' })).toBeDisabled();
	return true;
}

/** Assert the loaded queue, its empty result, or its handled malformed response. */
export async function preparePickerQueue(component: Locator, variant: string) {
	if (!['queue-empty', 'queue-populated', 'queue-error'].includes(variant)) return false;
	if (variant === 'queue-empty')
		await expect(component.getByText('Nothing is queued for this session.')).toBeVisible();
	await component.getByRole('button', { name: 'Show queued sessions' }).click();
	if (variant === 'queue-error')
		await expect(component.getByRole('alert')).toHaveText('Queued sessions could not be read.');
	else
		await expect(
			component.getByText(
				variant === 'queue-empty'
					? 'No queued sessions.'
					: /Claude Opus 5.5 · xhigh effort · pending/
			)
		).toBeVisible();
	return true;
}
