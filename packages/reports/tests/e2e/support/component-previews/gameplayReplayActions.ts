import { expect, type Locator, type Page } from '@playwright/test';

/** Hold the requested frame in flight so the real loading overlay remains visible. */
export async function routeGameplayLoading(page: Page, id: string, variant: string) {
	if (id !== 'reports.component.gameplay-replay' || variant !== 'loading') return;
	await page.route('**/media/gameplay-loading.svg', async () => {
		await new Promise<void>((resolve) => page.once('close', () => resolve()));
	});
}

/** Reach replay states through the player controls and check their visible results. */
export async function prepareGameplayReplay(component: Locator, variant: string) {
	if (variant === 'live-empty')
		return await expect(component.getByText('Waiting for the first capture')).toBeVisible();
	if (variant === 'live')
		await expect(component.getByText('Recording', { exact: true })).toBeVisible();
	if (variant === 'image-error') {
		await expect(component.getByText('This screenshot could not be loaded.')).toBeVisible();
		await expect(component.getByRole('button', { name: 'Retry' })).toBeVisible();
		await expect(component.getByRole('button', { name: 'Skip frame' })).toBeVisible();
	}
	if (variant === 'nonportable' || variant === 'download-preparing') {
		const download = component.getByRole('link', { name: /Download MP4/ });
		await expect(download).toBeVisible();
		if (variant === 'download-preparing') {
			await Promise.all([component.page().waitForEvent('download'), download.click()]);
			await expect(component.getByText(/Preparing MP4/)).toBeVisible();
		}
	}
	if (variant === 'last-frame') {
		await component.getByRole('button', { name: 'Jump to latest' }).click();
		await expect(component.getByText('Frame 3 of 3')).toBeVisible();
	}
	if (['playing', 'ended', 'waiting-live'].includes(variant)) await playReplay(component, variant);
	if (variant === 'fullscreen') {
		await component.getByRole('button', { name: 'Full screen', exact: true }).click();
		await expect(component.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
	}
	if (variant === 'speed-open' || variant === 'scene-open') {
		const select = component.getByRole('combobox', {
			name: variant === 'speed-open' ? 'Playback speed' : 'Jump to scene'
		});
		await select.click();
		await expect.poll(() => select.evaluate((node) => node.matches(':open'))).toBe(true);
	}
}

async function playReplay(component: Locator, variant: string) {
	if (variant !== 'playing')
		await component.getByRole('combobox', { name: 'Playback speed' }).selectOption('16');
	await component.getByRole('button', { name: 'Play replay' }).click();
	if (variant === 'playing')
		return await expect(component.getByRole('button', { name: 'Pause replay' })).toBeVisible();
	await expect(
		component.getByText(
			variant === 'ended' ? 'End of replay. Play to start again.' : 'Waiting for the next capture…'
		)
	).toBeVisible();
}
