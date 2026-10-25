import { expect } from '@playwright/test';
import type { Locator, TestInfo } from '@playwright/test';
import type {
	MatchScreenshot,
	MatchScreenshotOptions,
	ScreenshotName,
	ScreenshotTarget
} from './browserTest.types';

export function createMatchScreenshot(testInfo: TestInfo): MatchScreenshot {
	return async (target, name, options) => {
		assertReviewedSnapshots(testInfo);
		validateScreenshotName(name);
		await settleScreenshot(target, options);
		if (screenshotEvidenceRequested()) await attachScreenshot(testInfo, target, name, options);
		await expect(target).toHaveScreenshot(name, {
			animations: 'disabled',
			caret: 'hide',
			...options
		});
	};
}

function assertReviewedSnapshots(testInfo: { config: unknown }): void {
	const config = testInfo.config as { ignoreSnapshots?: boolean; updateSnapshots?: string };
	if (config.ignoreSnapshots || (config.updateSnapshots && config.updateSnapshots !== 'none'))
		throw new Error('matchScreenshot requires reviewed baselines and snapshot updates disabled.');
}

function validateScreenshotName(name: ScreenshotName): void {
	const names = typeof name === 'string' ? [name] : name;
	if (
		!names.length ||
		names.some(
			(part) =>
				!part.trim() || part.startsWith('/') || part.split('/').some((segment) => segment === '..')
		)
	)
		throw new Error('matchScreenshot requires a non-empty stable snapshot name.');
}

async function settleScreenshot(
	target: ScreenshotTarget,
	options?: MatchScreenshotOptions
): Promise<void> {
	if (isLocator(target)) {
		await target.scrollIntoViewIfNeeded();
		await target.evaluate(settleMedia, true);
	} else {
		for (const frame of target.frames())
			await frame.evaluate(settleMedia, [null, options?.fullPage === true] as [null, boolean]);
	}
}

function isLocator(target: ScreenshotTarget): target is Locator {
	return 'page' in target;
}

function screenshotEvidenceRequested(): boolean {
	return process.env.TAKE_SCREENSHOT === '1' || process.env.TAKE_SCREENSHOT === 'true';
}

async function attachScreenshot(
	testInfo: {
		attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void>;
	},
	target: ScreenshotTarget,
	name: ScreenshotName,
	options?: MatchScreenshotOptions
): Promise<void> {
	await testInfo.attach(`screenshot-${screenshotLabel(name)}`, {
		body: isLocator(target)
			? await target.screenshot({ animations: 'disabled', caret: 'hide' })
			: await target.screenshot({
					animations: 'disabled',
					caret: 'hide',
					fullPage: options?.fullPage
				}),
		contentType: 'image/png'
	});
}

function screenshotLabel(name: ScreenshotName): string {
	const label = typeof name === 'string' ? name : name.join('-');
	return label.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function settleMedia(target: Element | [null, boolean], fullPage?: boolean) {
	const [element, entirePage] = Array.isArray(target) ? target : [target, fullPage];
	await globalThis.document.fonts.ready;
	const root = element ?? globalThis.document;
	const images =
		root instanceof globalThis.HTMLImageElement
			? [root]
			: [...root.querySelectorAll<HTMLImageElement>('img')];
	const shown = (image: HTMLImageElement) => {
		const box = image.getBoundingClientRect(),
			style = globalThis.getComputedStyle(image);
		if (box.width <= 0 || box.height <= 0) return false;
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
			return false;
		if (element !== null || entirePage) return true;
		return box.bottom > 0 && box.top < globalThis.innerHeight;
	};
	for (const image of images) {
		if (!shown(image)) continue;
		image.loading = 'eager';
		await image.decode();
		if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
			throw new Error(`Screenshot image is not decoded: ${image.currentSrc || image.src}`);
	}
	await new Promise<void>((resolve) =>
		globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()))
	);
}
