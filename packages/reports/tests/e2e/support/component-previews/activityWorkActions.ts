import { expect, type Locator } from '@playwright/test';

/** Reach the activity work disclosure and the expanded commit list. */
export async function prepareActivityWorkState(component: Locator, variant: string) {
	if (variant === 'details-open' || variant === 'truncated') {
		const detail = component.locator('details').first();
		await detail.locator('summary').click();
		await expect(detail).toContainText('Noted on this commit');
		if (variant === 'truncated') {
			await expect(detail).toContainText('3 more components are on its page.');
			await expect(detail).toContainText('2 more reasons are on its page.');
		}
	}
	if (variant === 'no-reason')
		await expect(component.getByText('No reason is noted on this commit.')).toBeVisible();
	if (variant === 'many' || variant === 'expanded') {
		const button = component.getByRole('button', { name: 'Show all 6 commits' });
		await expect(button).toBeVisible();
		if (variant === 'expanded') {
			await button.click();
			await expect(component.getByRole('button', { name: 'Show fewer commits' })).toBeVisible();
		}
	}
}
