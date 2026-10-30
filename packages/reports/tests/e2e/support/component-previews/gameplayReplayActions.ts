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
		await expect(component.locator('.replay-meta .badge.running')).toContainText('Recording');
	if (variant === 'image-error' || variant === 'skipped') {
		await expect(component.getByText('This screenshot could not be loaded.')).toBeVisible();
		await expect(component.getByRole('button', { name: 'Retry' })).toBeVisible();
		await expect(component.getByRole('button', { name: 'Skip frame' })).toBeVisible();
		if (variant === 'skipped') {
			await component.getByRole('button', { name: 'Skip frame' }).click();
			await expectFrame(component, 2);
		}
	}
	if (variant === 'last-image-error') {
		await component.getByRole('button', { name: 'Jump to latest' }).click();
		await expect(component.getByText('This screenshot could not be loaded.')).toBeVisible();
		await expect(component.getByRole('button', { name: 'Skip frame' })).toHaveCount(0);
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
		await expectFrame(component, 3);
	}
	if (variant === 'single-frame')
		await expect(component.getByRole('slider', { name: 'Replay timeline' })).toBeDisabled();
	if (variant === 'scene-selected') {
		await component.getByRole('combobox', { name: 'Jump to scene' }).selectOption('2');
		await expectFrame(component, 2);
	}
	if (variant === 'speed-2x')
		await component.getByRole('combobox', { name: 'Playback speed' }).selectOption('2');
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

async function expectFrame(component: Locator, frame: number) {
	await expect(component.getByText(`Frame ${frame} of 3`)).toBeVisible();
	await component
		.locator('.replay-stage img')
		.evaluate((image: HTMLImageElement) => image.decode());
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
