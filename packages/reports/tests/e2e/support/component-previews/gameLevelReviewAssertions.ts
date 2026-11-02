import { expect, type Locator } from '@playwright/test';

/** Each review presentation shows its own note and enables only the actions it allows. */
export async function assertGameLevelReviewState(component: Locator, variant: string) {
	const build = component.getByRole('button', { name: 'Build level', exact: true });
	const approve = component.getByRole('button', { name: 'Approve level', exact: true });
	const regenerate = component.getByRole('button', { name: 'Regenerate', exact: true });
	if (variant === 'approved') {
		await expect(build, 'Build level is enabled once the proposal is approved').toBeEnabled();
		await expect(approve, 'Approve is spent after approval').toBeDisabled();
	}
	if (variant === 'regenerating') {
		await expect(regenerate, 'a pending request blocks another regeneration').toBeDisabled();
		await expect(component.getByPlaceholder('Optional: what should change?')).toBeDisabled();
	}
	if (variant === 'unavailable') await expect(regenerate).toBeDisabled();
	if (variant === 'built') {
		await expect(build, 'a built level hides the build action').toHaveCount(0);
		await expect(
			component.getByText('Preview and Checkpoints are open', { exact: false })
		).toBeVisible();
	}
}
