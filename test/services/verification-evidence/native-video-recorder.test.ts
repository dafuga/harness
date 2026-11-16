import { readFileSync, writeFileSync } from 'node:fs';
import { withTempDir } from '../../support/temporary';
import { chromium, type Browser, type Page } from '@playwright/test';
import { afterAll, beforeAll, expect, test as baseTest } from 'vitest';
import { NativeVideoRecorderService } from '../../../src/services/verification-evidence/NativeVideoRecorderService';
import {
	assertFlagReplacement,
	assertRecordingCache,
	assertRecordingFidelity,
	assertRecordingTimeline
} from './native-video-recorder/recordingAssertions';
import { browserErrorCollector } from '../../support/browserTest';

let browser: Browser;
const test = baseTest.extend<{ service: NativeVideoRecorderService }>({
	service: async ({}, use) => {
		await withTempDir('harness-native-video-', (root) => use(new NativeVideoRecorderService(root)));
	}
});
beforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
	await browser?.close();
});
function options(slotKey: string) {
	return {
		browser,
		slotKey,
		inputHash: 'a'.repeat(64),
		viewport: { width: 400, height: 240 },
		testedRevision: 'test-revision',
		diagnostics: browserErrorCollector('chromium'),
		prepare: async ({ page }: { page: Page }) => {
			await page.setContent(
				'<style>body{margin:0;background:white}button{width:100px;height:80px;margin:50px;background:rgb(255,0,0);transition:background-color 150ms linear}button:hover{background:rgb(0,0,255)}</style><button>Move</button>'
			);
		},
		perform: async ({
			page,
			mark
		}: {
			page: Page;
			mark: (kind: 'state' | 'edge', id: string) => Promise<void>;
		}) => {
			await mark('state', 'rest');
			await page.getByRole('button').hover();
			await page.waitForTimeout(180);
			expect(
				await page
					.getByRole('button')
					.evaluate((el) => globalThis.getComputedStyle(el).backgroundColor)
			).toBe('rgb(0, 0, 255)');
			await mark('state', 'hovered');
			await page.getByRole('button').evaluate((el) => {
				el.style.transition = 'none';
				el.style.backgroundColor = 'rgb(0, 255, 0)';
			});
			expect(
				await page
					.getByRole('button')
					.evaluate((el) => globalThis.getComputedStyle(el).backgroundColor)
			).toBe('rgb(0, 255, 0)');
			await mark('state', 'green');
			await page.getByRole('button').evaluate((el) => {
				el.style.backgroundColor = 'rgb(255, 0, 0)';
			});
			await mark('state', 'red');
		}
	};
}

test('NativeVideoRecorderService runs', ({ service }) => {
	expect(service.run()).toBe('native-video-recorder');
});

test('NativeVideoRecorderService record validates admission before a context opens', async ({
	service
}) => {
	expect(typeof service.record).toBe('function');
	const before = browser.contexts().length;
	for (const viewport of [
		{ width: 1922, height: 700 },
		{ width: 1900, height: 1200 },
		{ width: 399, height: 240 }
	]) {
		await expect(service.record({ ...options('invalid'), viewport })).rejects.toThrow(/viewport/);
	}
	expect(browser.contexts()).toHaveLength(before);
});

test('NativeVideoRecorderService record finalizes mapped native frames and reuses without capture', async ({
	service
}) => {
	expect(typeof service.record).toBe('function');
	let resets = 0;
	const start = performance.now();
	const result = await service.record({
		...options('success'),
		addressedFlags: ['flag-demo'],
		reset: async () => {
			resets++;
		}
	});
	expect(result.metadata.addressedFlags).toEqual(['flag-demo']);
	assertRecordingFidelity(result);
	expect(resets).toBe(1);
	expect(browser.contexts()).toHaveLength(0);
	expect(result.metadata.facts).toMatchObject({
		kind: 'video',
		codec: 'h264',
		pixelFormat: 'yuv420p',
		frameRate: 30,
		width: 400,
		height: 240
	});
	expect(result.metadata.native.frames.length).toBeGreaterThan(10);
	expect(result.metadata.mapping.length).toBe(result.metadata.facts.frameCount);
	expect(result.metadata.events.map((event) => event.id)).toEqual([
		'trigger',
		'rest',
		'hovered',
		'green',
		'red'
	]);
	assertRecordingTimeline(result);
	const bytes = readFileSync(result.video.path);
	expect(bytes.indexOf(Buffer.from('moov'))).toBeLessThan(bytes.indexOf(Buffer.from('mdat')));
	await assertRecordingCache(service, result, options('success'));
	await assertFlagReplacement(service, options('success'), result);
	console.info(
		JSON.stringify({
			workload: 'native hover recording encode lookup receipt',
			elapsedMs: performance.now() - start,
			runnerRssBytes: process.memoryUsage().rss,
			profile: 'focused Chromium headless Node'
		})
	);
}, 30_000);

test('NativeVideoRecorderService record preserves failed diagnostics and releases context and lock', async ({
	service
}) => {
	expect(typeof service.record).toBe('function');
	let resets = 0;
	await expect(
		service.record({
			...options('failure'),
			perform: async () => {
				throw new Error('script failed');
			},
			reset: async () => {
				resets++;
			}
		})
	).rejects.toThrow('script failed');
	expect(resets).toBe(1);
	expect(browser.contexts()).toHaveLength(0);
	expect(await service.lookup('failure', 'a'.repeat(64))).toBeUndefined();
	const result = await service.record(options('failure'));
	expect(result.metadata.facts.frameCount).toBeGreaterThan(0);
	writeFileSync(result.video.path, Buffer.alloc(20));
	await expect(service.lookup('failure', 'a'.repeat(64))).rejects.toThrow(/cache/);
}, 30_000);

test('NativeVideoRecorderService record refuses overlapping slot ownership', async ({
	service
}) => {
	expect(typeof service.record).toBe('function');
	let release: () => void = () => {};
	let entered: () => void = () => {};
	const waiting = new Promise<void>((resolve) => {
		release = resolve;
	});
	const started = new Promise<void>((resolve) => {
		entered = resolve;
	});
	const first = service.record({
		...options('locked'),
		prepare: async ({ page }) => {
			entered();
			await waiting;
			await options('locked').prepare({ page });
		}
	});
	try {
		await started;
		await expect(service.record(options('locked'))).rejects.toThrow(/locked/);
	} finally {
		release();
		await first;
	}
}, 30_000);
