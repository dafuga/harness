import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const previous = process.env.HARNESS_E2E_ROOT;
const directory = mkdtempSync(join(tmpdir(), 'harness-capture-readiness-'));
let settled: (typeof import('./support/harnessCapture'))['settled'];
test.beforeAll(async () => {
	process.env.HARNESS_E2E_ROOT = directory;
	({ settled } = await import('./support/harnessCapture'));
});
test.afterAll(() => {
	if (previous === undefined) delete process.env.HARNESS_E2E_ROOT;
	else process.env.HARNESS_E2E_ROOT = previous;
	rmSync(directory, { recursive: true, force: true });
});

test('ready images can be captured while the app continues polling in the background', async ({
	page
}) => {
	test.setTimeout(4000);
	await page.route('http://harness-readiness.test/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path === '/poll') {
			await new Promise((done) => setTimeout(done, 60));
			return route.fulfill({ contentType: 'application/json', body: '{}' });
		}
		if (path === '/image.svg') {
			await new Promise((done) => setTimeout(done, 200));
			return route.fulfill({
				contentType: 'image/svg+xml',
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="20"><rect width="32" height="20" fill="gold"/></svg>'
			});
		}
		return route.fulfill({
			contentType: 'text/html',
			body: '<h1>Ready capture</h1><div style="height:20000px"></div><img loading="lazy" src="/image.svg" alt="Loaded preview"><script>window.polls=0;async function poll(){await fetch("/poll");window.polls++;setTimeout(poll,25)}poll()</script>'
		});
	});
	await page.goto('http://harness-readiness.test/', { waitUntil: 'domcontentloaded' });
	expect(
		await page.locator('img').evaluate((image) => image.getBoundingClientRect().top)
	).toBeGreaterThan(await page.evaluate(() => innerHeight));
	await settled(page);
	expect(
		await page.locator('img').evaluate((image: HTMLImageElement) => ({
			complete: image.complete,
			width: image.naturalWidth,
			height: image.naturalHeight
		}))
	).toEqual({ complete: true, width: 32, height: 20 });
	await expect.poll(() => page.evaluate(() => Reflect.get(window, 'polls'))).toBeGreaterThan(0);
});

test('an image that failed to load is rejected as capture evidence', async ({ page }) => {
	await page.route('http://harness-readiness.test/**', (route) =>
		route.fulfill({
			status: route.request().url().endsWith('.png') ? 404 : 200,
			contentType: 'text/html',
			body: '<img src="/missing.png" alt="Missing preview">'
		})
	);
	await page.goto('http://harness-readiness.test/');
	await expect(settled(page)).rejects.toThrow();
});

test('an image that cannot decode is rejected even after a successful load', async ({ page }) => {
	await page.setContent(
		'<img alt="Undecodable preview" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2220%22/%3E">'
	);
	await page.locator('img').evaluate(async (image: HTMLImageElement) => {
		await image.decode();
		image.decode = () => Promise.reject(new DOMException('Decode failed', 'EncodingError'));
	});
	await expect(settled(page)).rejects.toThrow();
});
