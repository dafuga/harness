import { test as base, expect } from '@playwright/test';
import type { BrowserContext, ConsoleMessage, Page, TestInfo } from '@playwright/test';

export * from '@playwright/test';

interface BrowserError {
	type: 'console' | 'pageerror';
	message: string;
	page: string;
	source?: string;
	line?: number;
	column?: number;
	stack?: string;
}
interface ExpectedBrowserError {
	type: BrowserError['type'];
	message: string;
	reason: string;
	source?: string;
}

/** Normal flows require no errors. Deliberate failures declare exact expected diagnostics. */
export const test = base.extend<{ browserErrors: ReturnType<typeof browserErrorCollector> }>({
	context: async ({ context, browserErrors }, use) => {
		browserErrors.watch(context);
		await use(context);
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
		async finish(testInfo?: Pick<TestInfo, 'attach'>) {
			for (const dispose of cleanup) dispose();
			if (errors.length && testInfo)
				await testInfo.attach('browser-errors', {
					body: JSON.stringify({ browser, errors, expected }, null, 2),
					contentType: 'application/json'
				});
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

function observeContext(context: BrowserContext, errors: BrowserError[]): () => void {
	const cleanup: (() => void)[] = [];
	const watch = (page: Page) => cleanup.push(observePage(page, errors));
	context.on('page', watch);
	for (const page of context.pages()) watch(page);
	return () => {
		context.off('page', watch);
		for (const dispose of cleanup) dispose();
	};
}

function observePage(page: Page, errors: BrowserError[]): () => void {
	const consoleError = (message: ConsoleMessage) => {
		if (message.type() !== 'error') return;
		const location = message.location();
		errors.push({
			type: 'console',
			message: message.text(),
			page: page.url(),
			source: location.url,
			line: location.lineNumber,
			column: location.columnNumber
		});
	};
	const pageError = (error: Error) =>
		errors.push({
			type: 'pageerror' as const,
			message: error.message,
			page: page.url(),
			stack: error.stack
		});
	page.on('console', consoleError);
	page.on('pageerror', pageError);
	return () => {
		page.off('console', consoleError);
		page.off('pageerror', pageError);
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
