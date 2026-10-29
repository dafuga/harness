import { expect, type Locator } from '@playwright/test';

/** Check the visible observation and switch status represented by each card variant. */
export async function assertProviderPickerCardState(component: Locator, variant: string) {
	if (variant === 'unknown') {
		await expect(component.getByText('Unknown', { exact: true })).toBeVisible();
		return expect(component.getByText('Nothing is queued for this session.')).toBeVisible();
	}
	if (variant === 'in-use') return expect(component.getByText(/In use · clients: 2/)).toBeVisible();
	if (variant === 'locked')
		return expect(component.getByRole('button', { name: 'Cancel pending switch' })).toBeDisabled();
	await expect(component.locator('.picker-request')).toHaveAttribute('data-status', variant);
	await expect(component.getByRole('button', { name: 'Cancel pending switch' })).toHaveCount(0);
}
