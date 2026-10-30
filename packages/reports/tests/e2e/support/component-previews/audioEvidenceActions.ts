import { expect, type Locator } from '@playwright/test';

/** Reach and check recording states through the same controls a reader uses. */
export async function prepareAudioEvidence(component: Locator, variant: string) {
	if (variant === 'notes' || variant === 'transcript-closed') {
		await component.locator('.audio-details summary').click();
		if (variant === 'notes')
			await expect(
				component.getByText('Timing and diction were reviewed before approval.', { exact: true })
			).toBeVisible();
	}
	if (variant === 'playing') {
		const audio = component.locator('audio');
		await audio.evaluate((element: HTMLAudioElement) => element.play());
		await expect
			.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused))
			.toBe(false);
	}
	if (variant === 'audio-error') {
		await component.locator('audio').evaluate(async (element: HTMLAudioElement) => {
			try {
				await element.play();
			} catch {
				// The invalid fixture exercises the real media-error path.
			}
		});
		await expect(component.locator('.audio-unavailable')).toBeVisible();
	}
	const missing = ['unavailable', 'audio-error'].includes(variant);
	await expect(component.locator('.audio-card.unavailable')).toHaveCount(missing ? 1 : 0);
	if (variant === 'no-details') await expect(component.locator('.audio-details')).toHaveCount(0);
	if (variant === 'no-duration') await expect(component.locator('.audio-duration')).toHaveCount(0);
	if (['notes-closed', 'transcript-closed'].includes(variant))
		await expect(component.locator('.audio-details')).not.toHaveAttribute('open');
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(component.locator('.badge')).toHaveClass(new RegExp(variant));
}
