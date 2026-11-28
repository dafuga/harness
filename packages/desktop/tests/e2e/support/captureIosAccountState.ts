import type { Page } from '@playwright/test';

/** Captures the settled iOS account surface at each supported width when evidence is requested. */
export async function captureIosAccountState(page: Page, state: string) {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const initial = page.viewportSize();
	for (const [width, height] of [
		[390, 844],
		[768, 1024],
		[1440, 900]
	]) {
		await page.setViewportSize({ width, height });
		await page.evaluate(async () => {
			await document.fonts.ready;
			for (const img of document.querySelectorAll<HTMLImageElement>('main img')) await img.decode();
		});
		const folder = process.env.HEADLESS_RUN_ARTIFACTS ?? '/tmp';
		await page.screenshot({
			path: folder + '/zgfvhk-' + state + '-' + width + '-' + process.env.SCREENSHOT_LABEL + '.png'
		});
	}
	if (initial) await page.setViewportSize(initial);
}
