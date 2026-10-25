import type {
	BrowserError,
	ExpectedBrowserError,
	DiagnosticInfo,
	MatchScreenshot,
	ScreenshotName,
	ScreenshotTarget
} from './browserTest.types';
import { test as base, expect } from '@playwright/test';
import type { BrowserContext, ConsoleMessage, Locator, Page, WebError } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export * from '@playwright/test';

/** Normal flows require no errors. Deliberate failures declare exact expected diagnostics. */
export const test = base.extend<{
	browserErrors: ReturnType<typeof browserErrorCollector>;
	matchScreenshot: MatchScreenshot;
}>({
	context: async ({ context, browserErrors }, use) => {
		browserErrors.watch(context);
		await use(context);
	},
	matchScreenshot: async (_fixtures, use, testInfo) => {
		await use(async (target, name, options) => {
			assertReviewedSnapshots(testInfo);
			validateScreenshotName(name);
			await settleScreenshot(target);
			if (screenshotEvidenceRequested()) await attachScreenshot(testInfo, target, name);
			await expect(target).toHaveScreenshot(name, options);
		});
	},
	browserErrors: [
		async ({ browserName }, use, testInfo) => {
			const errors = browserErrorCollector(browserName);
			try {
				await use(errors);
			} finally {
				await errors.finish(testInfo);
			}
		},
		{ auto: true }
	]
});

function assertReviewedSnapshots(testInfo: { config: unknown }): void {
	const config = testInfo.config as { ignoreSnapshots?: boolean; updateSnapshots?: string };
	if (config.ignoreSnapshots || (config.updateSnapshots && config.updateSnapshots !== 'none'))
		throw new Error('matchScreenshot requires reviewed baselines and snapshot updates disabled.');
}

function validateScreenshotName(name: ScreenshotName): void {
	const names = typeof name === 'string' ? [name] : name;
	if (!names.length || names.some((part) => !part.trim()))
		throw new Error('matchScreenshot requires a non-empty stable snapshot name.');
}

async function settleScreenshot(target: ScreenshotTarget): Promise<void> {
	const page = pageFor(target);
	if (isLocator(target)) await target.waitFor({ state: 'visible' });
	await page.evaluate(async () => {
		await globalThis.document.fonts.ready;
		const images = [...globalThis.document.images].filter((image) => {
			const box = image.getBoundingClientRect();
			const style = globalThis.getComputedStyle(image);
			return (
				box.width > 0 &&
				box.height > 0 &&
				box.bottom > 0 &&
				box.top < globalThis.innerHeight &&
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				style.opacity !== '0'
			);
		});
		for (const image of images) {
			await image.decode();
			if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
				throw new Error(
					`Visible screenshot image is not decoded: ${image.currentSrc || image.src}`
				);
		}
		await new Promise<void>((resolve) =>
			globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()))
		);
	});
}

function isLocator(target: ScreenshotTarget): target is Locator {
	return 'page' in target;
}

function pageFor(target: ScreenshotTarget): Page {
	return isLocator(target) ? target.page() : target;
}

function screenshotEvidenceRequested(): boolean {
	return process.env.TAKE_SCREENSHOT === '1' || process.env.TAKE_SCREENSHOT === 'true';
}

async function attachScreenshot(
	testInfo: {
		attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void>;
	},
	target: ScreenshotTarget,
	name: ScreenshotName
): Promise<void> {
	await testInfo.attach(`screenshot-${screenshotLabel(name)}`, {
		body: await target.screenshot({ animations: 'disabled', caret: 'hide' }),
		contentType: 'image/png'
	});
}

function screenshotLabel(name: ScreenshotName): string {
	const label = typeof name === 'string' ? name : name.join('-');
	return label.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function browserErrorCollector(browser?: string) {
	const errors: BrowserError[] = [];
	const expected: ExpectedBrowserError[] = [];
	const contexts = new Set<BrowserContext>();
	const cleanup: (() => void)[] = [];
	return {
		expectError(error: ExpectedBrowserError) {
			if (!error.message.trim() || !error.reason.trim())
				throw new Error('Expected browser errors require an exact message and a reason.');
			expected.push(error);
		},
		/** Watch additional contexts before navigation, including Electron and manual contexts. */
		watch(context: BrowserContext) {
			if (contexts.has(context)) return;
			contexts.add(context);
			cleanup.push(observeContext(context, errors));
		},
		async finish(testInfo?: DiagnosticInfo) {
			for (const dispose of cleanup) dispose();
			if ((errors.length || expected.length) && testInfo) {
				const diagnostic = { ...identity(testInfo), browser, errors, expected };
				if (process.env.HARNESS_EVIDENCE_DIR) {
					mkdirSync(process.env.HARNESS_EVIDENCE_DIR, { recursive: true });
					appendFileSync(
						join(process.env.HARNESS_EVIDENCE_DIR, 'browser-errors.ndjson'),
						`${JSON.stringify(diagnostic)}\n`
					);
				}
				await testInfo.attach('browser-errors', {
					body: JSON.stringify(diagnostic, null, 2),
					contentType: 'application/json'
				});
			}
			expect(
				unmatchedErrors(errors, expected),
				'Unexpected browser errors or missing expected errors'
			).toEqual({
				unexpected: [],
				missing: []
			});
		}
	};
}

function identity(info: DiagnosticInfo) {
	return {
		test: info.titlePath?.join(' › ') ?? 'Browser test',
		file: info.file && info.config ? relative(info.config.rootDir, info.file) : '',
		project: info.project?.name ?? '',
		retry: info.retry ?? 0
	};
}

function observeContext(context: BrowserContext, errors: BrowserError[]): () => void {
	// A popup's first script can run before the context announces its page.
	const consoleError = (message: ConsoleMessage) => {
		if (message.type() !== 'error') return;
		const location = message.location();
		errors.push({
			type: 'console',
			message: message.text(),
			page: message.page()?.url() ?? '',
			source: location.url,
			line: location.lineNumber,
			column: location.columnNumber
		});
	};
	const pageError = (event: WebError) => {
		const error = event.error();
		errors.push({
			type: 'pageerror' as const,
			message: error.message,
			page: event.page()?.url() ?? '',
			stack: error.stack
		});
	};
	context.on('console', consoleError);
	context.on('weberror', pageError);
	return () => {
		context.off('console', consoleError);
		context.off('weberror', pageError);
	};
}

function unmatchedErrors(errors: BrowserError[], expected: ExpectedBrowserError[]) {
	const unexpected = [...errors];
	const missing: ExpectedBrowserError[] = [];
	for (const wanted of expected) {
		const index = unexpected.findIndex(
			(error) =>
				error.type === wanted.type &&
				error.message === wanted.message &&
				(wanted.source === undefined || error.source === wanted.source)
		);
		if (index < 0) missing.push(wanted);
		else unexpected.splice(index, 1);
	}
	return { unexpected, missing };
}
