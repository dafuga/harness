import { expect, type Locator } from '@playwright/test';

/** Reach and check recording states through the same controls a reader uses. */
export async function prepareAudioEvidence(component: Locator, variant: string) {
	if (['notes', 'transcript-closed', 'notes-transcript-closed'].includes(variant)) {
		await component.locator('.audio-details summary').click();
		if (variant === 'notes')
			await expect(
				component.getByText('Timing and diction were reviewed before approval.', { exact: true })
			).toBeVisible();
	}
	if (variant === 'playing') {
		const audio = component.locator('audio');
		// Let real playback advance so the player shows elapsed time and progress.
		await audio.evaluate((element: HTMLAudioElement) => element.play());
		await expect
			.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime), {
				timeout: 20000
			})
			.toBeGreaterThan(6);
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
	await assertAudioEvidence(component, variant);
}

async function assertAudioEvidence(component: Locator, variant: string) {
	const missing = ['unavailable', 'audio-error'].includes(variant);
	await expect(component.locator('.audio-card.unavailable')).toHaveCount(missing ? 1 : 0);
	if (['no-details', 'minimal'].includes(variant))
		await expect(component.locator('.audio-details')).toHaveCount(0);
	if (variant === 'minimal') await expect(component.locator('.audio-duration')).toHaveText('0:42');
	if (['notes-closed', 'transcript-closed', 'notes-transcript-closed'].includes(variant))
		await expect(component.locator('.audio-details')).not.toHaveAttribute('open');
	if (variant === 'minimal') {
		await expect(component.locator('.audio-source')).toHaveCount(0);
		await expect(component.locator('.evidence-meta time')).toHaveCount(0);
		await expect(component.getByText('No provenance recorded.', { exact: true })).toBeVisible();
	}
	if (variant.startsWith('phase-'))
		await expect(component.locator('.audio-kind')).toContainText(
			new RegExp(variant.slice('phase-'.length), 'i')
		);
	if (variant === 'standing')
		await expect(component.locator('.audio-kind')).toContainText('Baseline recording');
	if (['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'].includes(variant))
		await expect(component.locator('.badge')).toHaveClass(new RegExp(variant));
}
