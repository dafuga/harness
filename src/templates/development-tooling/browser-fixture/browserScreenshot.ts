import { expect } from '@playwright/test';
import type { Locator, TestInfo } from '@playwright/test';
import type {
	MatchScreenshot,
	MatchScreenshotOptions,
	ScreenshotName,
	ScreenshotTarget
} from './browserScreenshot.types';
import { recordCaseScreenshot } from './browserCaseCapture';

export function createMatchScreenshot(testInfo: TestInfo): MatchScreenshot {
	return async (target, name, options) => {
		assertReviewedSnapshots(testInfo);
		validateScreenshotName(name);
		await settleScreenshot(target, options);
		let captured: Buffer | undefined;
		if (screenshotEvidenceRequested()) {
			captured = await attachScreenshot(testInfo, target, name, options);
			await recordCaseScreenshot(testInfo, target, name, {
				bytes: captured,
				fullPage: options?.fullPage === true
			});
		}
		await expect(target).toHaveScreenshot(name, {
			animations: 'disabled',
			caret: 'hide',
			...options
		});
		if (captured && process.env.HARNESS_VERIFY === '1')
			expect(captured).toMatchSnapshot(name, {
				threshold: options?.threshold,
				maxDiffPixels: options?.maxDiffPixels,
				maxDiffPixelRatio: options?.maxDiffPixelRatio
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
): Promise<Buffer> {
	const shared = imageOptions(options);
	const body = isLocator(target)
		? await target.screenshot(shared)
		: await target.screenshot({
				...shared,
				fullPage: options?.fullPage
			});
	await testInfo.attach(`screenshot-${screenshotLabel(name)}`, { body, contentType: 'image/png' });
	return body;
}

function imageOptions(options?: MatchScreenshotOptions) {
	return {
		animations: options?.animations ?? 'disabled',
		caret: options?.caret ?? 'hide',
		mask: options?.mask,
		maskColor: options?.maskColor,
		omitBackground: options?.omitBackground,
		scale: options?.scale ?? 'css'
	} as const;
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
