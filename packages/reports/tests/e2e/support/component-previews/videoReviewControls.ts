import { pictured } from '../sharedSelect';
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
	await assertUnsettledReview(component);
	await assertRetainedFrame(component);
	await expect(component.locator('output')).toContainText('Frame 5');
	await component.getByRole('slider', { name: 'Frame timeline' }).press('End');
	await expect(component.locator('output')).toContainText('Frame 29');
	await expect(flag).toBeEnabled();
	await expect.poll(() => player.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
	await expect
		.poll(() => player.evaluate((video: HTMLVideoElement) => Math.floor(video.currentTime * 30)))
		.toBe(29);
}

async function assertUnsettledReview(component: Locator) {
	const player = component.locator('video');
	const flag = component.getByRole('button', { name: 'Flag current frame', exact: true });
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
	await expect(component.locator('output')).toContainText('Frame 15');
}

async function assertRetainedFrame(component: Locator) {
	await component.locator('.frame-flags li').first().getByRole('button').click();
	await expect
		.poll(() => component.locator('video').evaluate((v: HTMLVideoElement) => v.seeking))
		.toBe(false);
	await expect
		.soft(component.locator('output'), 'retained frame seeks to its exact canonical frame')
		.toContainText('Frame 5 · 0.17s');
	const image = component.getByRole('img', { name: /^Flagged frame at/ });
	await expect(image).toBeVisible();
	const dimensions = await image.evaluate((img: HTMLImageElement) => ({
		width: img.getBoundingClientRect().width,
		height: img.getBoundingClientRect().height,
		naturalWidth: img.naturalWidth,
		naturalHeight: img.naturalHeight
	}));
	expect
		.soft(
			Math.abs(
				dimensions.width / dimensions.height - dimensions.naturalWidth / dimensions.naturalHeight
			),
			'retained frame presentation preserves its actual aspect ratio'
		)
		.toBeLessThan(0.02);
	await component.page().evaluate(async () => {
		await document.fonts.ready;
		await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
	});
	await pictured(component.page(), 'video-frame-review-' + component.page().viewportSize()!.width);
}
