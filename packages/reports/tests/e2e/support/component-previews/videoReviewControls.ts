import { expect, type Locator } from '@playwright/test';

/** Review uses a decoded, paused frame; playback and unsettled seeking cannot submit one. */
export async function assertVideoReviewControls(component: Locator) {
	const player = component.locator('video');
	const flag = component.getByRole('button', { name: 'Flag current frame', exact: true });
	await expect
		.poll(() => player.evaluate((video: HTMLVideoElement) => video.readyState))
		.toBeGreaterThanOrEqual(2);
	await expect(flag).toBeEnabled();
	await player.evaluate((video: HTMLVideoElement) => {
		video.loop = true;
		return video.play();
	});
	await expect(
		flag,
		'playing footage must be paused before an exact frame can be flagged'
	).toBeDisabled();
	await player.evaluate((video: HTMLVideoElement) => video.pause());
	await expect(flag).toBeEnabled();
	const guarded = await player.evaluate(
		(video: HTMLVideoElement) =>
			new Promise<boolean>((resolve) => {
				video.addEventListener(
					'seeking',
					() =>
						queueMicrotask(() => {
							resolve(
								document.querySelector<HTMLButtonElement>('.video-evidence button[type="submit"]')!
									.disabled
							);
						}),
					{ once: true }
				);
				video.currentTime = 0.5;
			})
	);
	expect(guarded, 'seeking must settle before the reviewed frame can be submitted').toBe(true);
	await expect.poll(() => player.evaluate((video: HTMLVideoElement) => video.seeking)).toBe(false);
	await expect(flag).toBeEnabled();
	await expect(component.locator('output')).toContainText('Frame 5');
	await component.getByRole('slider', { name: 'Frame timeline' }).press('End');
	await expect(component.locator('output')).toContainText('Frame 9');
	await expect(flag).toBeEnabled();
	await expect.poll(() => player.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
	await expect
		.poll(() => player.evaluate((video: HTMLVideoElement) => Math.floor(video.currentTime * 10)))
		.toBe(9);
}
