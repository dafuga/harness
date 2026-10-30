import { expect, type Locator } from '@playwright/test';

/** Check the visible observation and switch status represented by each card variant. */
export async function assertProviderPickerCardState(component: Locator, variant: string) {
	if (variant === 'unknown') {
		await expect(component.getByText('Unknown', { exact: true })).toBeVisible();
		return expect(component.getByText('Nothing is queued for this session.')).toBeVisible();
	}
	const active = component.locator('.picker-active');
	const request = component.locator('.picker-request');
	await expect(active).toContainText(variant === 'applied' ? 'Claude Opus 5.5' : 'GPT 6.1');
	await expect(request).toContainText('Claude Opus 5.5');
	if (variant === 'in-use') return expect(component.getByText(/In use · clients: 2/)).toBeVisible();
	if (variant === 'locked')
		return expect(component.getByRole('button', { name: 'Cancel pending switch' })).toBeDisabled();
	await expect(request).toHaveAttribute('data-status', variant);
	await expect(component.getByRole('button', { name: 'Cancel pending switch' })).toHaveCount(0);
}
