import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { expect } from '@playwright/test';
import type { Locator, LocatorScreenshotOptions, TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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
		await settleScreenshot(target, options, !hasReviewedSnapshot(testInfo, name));
		try {
			await expect(target).toHaveScreenshot(name, {
				animations: 'disabled',
				caret: 'hide',
				...options
			});
		} catch (error) {
			if (screenshotEvidenceRequested()) {
				try {
					await attachScreenshot(testInfo, target, name, options);
				} catch (diagnosticError) {
					await testInfo
						.attach('screenshot-diagnostic-error', {
							body: String(diagnosticError),
							contentType: 'text/plain'
						})
						.catch(() => undefined);
				}
			}
			throw error;
		}
		if (screenshotEvidenceRequested()) await attachScreenshot(testInfo, target, name, options);
	};
}

/** Public screenshot paths resolve global templates; array stems deliberately retain separators. */
function hasReviewedSnapshot(testInfo: TestInfo, name: ScreenshotName): boolean {
	if (typeof name === 'string')
		return existsSync(testInfo.snapshotPath(name, { kind: 'screenshot' }));
	const file = join(...name);
	const extension = extname(file);
	const marker = 'harness' + randomUUID().replaceAll('-', '');
	const path = testInfo.snapshotPath(marker + extension, { kind: 'screenshot' });
	// A template without {arg} contains no marker and stays unchanged.
	return existsSync(path.replaceAll(marker, file.slice(0, file.length - extension.length)));
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
	options: MatchScreenshotOptions | undefined,
	needsPixelReadiness: boolean
): Promise<void> {
	if (isLocator(target)) {
		await target.scrollIntoViewIfNeeded();
		await target.evaluate(settleMedia, true);
	} else {
		for (const frame of target.frames())
			await frame.evaluate(settleMedia, [null, options?.fullPage === true] as [null, boolean]);
	}
	if (needsPixelReadiness) await settlePixels(target, options);
}

/** Driver-side captures work even when a manual browser context disables page scripts. */
async function settlePixels(
	target: ScreenshotTarget,
	options?: MatchScreenshotOptions
): Promise<void> {
	const budget = screenshotBudget(options?.timeout);
	const deadline = Date.now() + budget;
	const settings = await screenshotSettings(options);
	let previous: Buffer | undefined;
	while (Date.now() < deadline) {
		const timeout = deadline - Date.now();
		if (timeout <= 0) break;
		const current = isLocator(target)
			? await target.screenshot({ ...settings, timeout })
			: await target.screenshot({
					...settings,
					fullPage: options?.fullPage,
					clip: options?.clip,
					timeout
				});
		if (previous?.equals(current)) return;
		previous = current;
	}
	throw new Error(`Screenshot pixels did not stabilize within ${budget} ms.`);
}

function screenshotBudget(limit?: number): number {
	return limit !== undefined && Number.isFinite(limit) && limit > 0 ? limit : 5000;
}

/** Select only supported screenshot options; assertion comparison tolerances stay in expect. */
async function screenshotSettings(
	options?: MatchScreenshotOptions
): Promise<LocatorScreenshotOptions> {
	const selected = options ?? {};
	const paths = screenshotStylePaths(selected.stylePath);
	const styles = await Promise.all(
		paths.map(async (path) =>
			(await readFile(path, { encoding: 'utf8', signal: selected.signal })).trim()
		)
	);
	return {
		animations: selected.animations ?? 'disabled',
		caret: selected.caret ?? 'hide',
		mask: selected.mask,
		maskColor: selected.maskColor,
		omitBackground: selected.omitBackground,
		scale: selected.scale ?? 'css',
		signal: selected.signal,
		style: styles.join('\n').trim() || undefined,
		timeout: selected.timeout
	};
}

function screenshotStylePaths(paths: MatchScreenshotOptions['stylePath']): string[] {
	if (paths === undefined) return [];
	return Array.isArray(paths) ? paths : [paths];
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
	const settings = await screenshotSettings(options);
	// Diagnostic scope is per-call options, not the matcher's resolved global screenshot defaults.
	await testInfo.attach(`screenshot-per-call-diagnostic-${screenshotLabel(name)}`, {
		body: isLocator(target)
			? await target.screenshot(settings)
			: await target.screenshot({ ...settings, fullPage: options?.fullPage, clip: options?.clip }),
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
}
