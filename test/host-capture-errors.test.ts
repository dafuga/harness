import { expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { chromium, type Browser } from '@playwright/test';
import { captureHost } from './support/hostCapture';
import type { LocalWorker } from './support/workers';

test('a host flow failure preserves both its original exception and browser diagnostics', async () => {
	const page = Object.assign(new EventEmitter(), {
		url: () => 'https://fixture.test/harness',
		goto: async () => {
			const message = {
				type: () => 'error',
				text: () => 'backend failed',
				page: () => page,
				location: () => ({ url: 'https://fixture.test/api', lineNumber: 0, columnNumber: 0 })
			};
			context.emit('console', message);
			page.emit('console', message);
			throw new Error('Navigation failed');
		}
	});
	const context = Object.assign(new EventEmitter(), {
		pages: () => [],
		addCookies: async () => {},
		newPage: async () => {
			context.emit('page', page);
			return page;
		}
	});
	const close = vi.fn(async () => {});
	const browser = { newContext: async () => context, close } as unknown as Browser;
	const launch = vi.spyOn(chromium, 'launch').mockResolvedValue(browser);
	try {
		const failure = await captureHost(
			{ url: 'https://fixture.test' } as LocalWorker,
			'/unused',
			'a'.repeat(40)
		).catch((error: AggregateError) => error);
		expect(failure).toBeInstanceOf(AggregateError);
		const error = failure as AggregateError;
		expect(error.errors).toHaveLength(2);
		expect(error.message).toContain('Navigation failed');
		expect(error.message).toContain('backend failed');
		expect(close).toHaveBeenCalledOnce();
		expect(page.listenerCount('console')).toBe(0);
		expect(context.listenerCount('page')).toBe(0);
		expect(context.listenerCount('console')).toBe(0);
		expect(context.listenerCount('weberror')).toBe(0);
	} finally {
		launch.mockRestore();
	}
});
