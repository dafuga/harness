import type {
	BrowserError,
	ExpectedBrowserError,
	DiagnosticInfo,
	MatchScreenshot
} from './browserTest.types';
import { test as base, expect } from '@playwright/test';
import type { BrowserContext, ConsoleMessage, WebError } from '@playwright/test';
import { createMatchScreenshot } from './browserScreenshot';
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
	// eslint-disable-next-line no-empty-pattern -- Playwright requires fixture destructuring.
	matchScreenshot: async ({}, use, testInfo) => {
		await use(createMatchScreenshot(testInfo));
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
