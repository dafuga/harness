import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { NativeVideoRecorderService } from '../../../src/services/verification-evidence/NativeVideoRecorderService';
import { browserErrorCollector } from '../../support/browserTest';

let browser: Browser;
const root = mkdtempSync(join(tmpdir(), 'harness-native-video-'));
beforeAll(async () => {
	browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
	await browser?.close();
	rmSync(root, { recursive: true, force: true });
});
const service = new NativeVideoRecorderService(root);
function options(slotKey: string) {
	return {
		browser,
		slotKey,
		inputHash: 'a'.repeat(64),
		viewport: { width: 400, height: 240 },
		testedRevision: 'test-revision',
		diagnostics: browserErrorCollector('chromium'),
		prepare: async ({ page }: { page: import('@playwright/test').Page }) => {
			await page.setContent(
				'<style>body{margin:0;background:white}button{width:100px;height:80px;margin:50px;background:rgb(255,0,0);transition:background-color 150ms linear}button:hover{background:rgb(0,0,255)}</style><button>Move</button>'
			);
		},
		perform: async ({
			page,
			mark
		}: {
			page: import('@playwright/test').Page;
			mark: (kind: 'state' | 'edge', id: string) => Promise<void>;
		}) => {
			await mark('state', 'rest');
			await page.getByRole('button').hover();
			await page.waitForTimeout(180);
			expect(
				await page.getByRole('button').evaluate((el) => getComputedStyle(el).backgroundColor)
			).toBe('rgb(0, 0, 255)');
			await mark('state', 'hovered');
		}
	};
}

test('NativeVideoRecorderService runs', () => {
	expect(service.run()).toBe('native-video-recorder');
});

test('NativeVideoRecorderService record validates admission before a context opens', async () => {
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

test('NativeVideoRecorderService record finalizes mapped native frames and reuses without capture', async () => {
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
	const pixels = decodedRgbFrames(result.video.path);
	const sourcePixels = new Map<number, Buffer>();
	for (const sample of result.metadata.mapping) {
		if (!sourcePixels.has(sample.sourceFrame))
			sourcePixels.set(
				sample.sourceFrame,
				decodedRgbFrames(
					join(result.directory, result.metadata.native.frames[sample.sourceFrame].file)
				)
			);
		const actual = pixels.subarray(sample.frameNumber * 3, sample.frameNumber * 3 + 3);
		const expected = sourcePixels.get(sample.sourceFrame)!;
		expect(
			Math.max(...actual.map((channel, index) => Math.abs(channel - expected[index])))
		).toBeLessThan(45);
	}
	expect(
		new Set(
			result.metadata.mapping.map((sample) =>
				pixels.subarray(sample.frameNumber * 3, sample.frameNumber * 3 + 3).toString('hex')
			)
		).size
	).toBeGreaterThan(3);
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
	expect(result.metadata.events.map((event) => event.id)).toEqual(['trigger', 'rest', 'hovered']);
	for (const event of result.metadata.events) {
		expect(event.atSeconds).toBeGreaterThanOrEqual(0.3);
		expect(event.frameNumber / 30 - event.atSeconds).toBeGreaterThanOrEqual(-0.001);
		expect(event.frameNumber / 30 - event.atSeconds).toBeLessThan(1 / 30 + 0.001);
	}
	expect(result.metadata.marker.nativeTimestamp).toBeLessThan(
		result.metadata.interval.startTimestamp
	);
	expect(
		result.metadata.interval.endTimestamp - result.metadata.events.at(-1)!.timestamp
	).toBeGreaterThanOrEqual(500);
	const bytes = readFileSync(result.video.path);
	expect(bytes.indexOf(Buffer.from('moov'))).toBeLessThan(bytes.indexOf(Buffer.from('mdat')));
	const cached = await service.lookup('success', 'a'.repeat(64));
	expect(cached?.metadata).toEqual(result.metadata);
	const again = await service.record({
		...options('success'),
		prepare: async () => {
			throw new Error('must not open cache');
		}
	});
	expect(again.metadata.capturedAt).toBe(result.metadata.capturedAt);
	expect(browser.contexts()).toHaveLength(0);
	expect(existsSync(join(result.directory, 'raw'))).toBe(true);
	await expect(
		service.acknowledge(result, {
			record: 'receipt',
			videoSha256: 'wrong',
			posterSha256: result.poster.sha256
		})
	).rejects.toThrow(/receipt/);
	await service.acknowledge(result, {
		record: 'receipt',
		videoSha256: result.video.sha256,
		posterSha256: result.poster.sha256
	});
	expect(existsSync(join(result.directory, 'raw'))).toBe(false);
	console.info(
		JSON.stringify({
			workload: 'native hover recording encode lookup receipt',
			elapsedMs: performance.now() - start,
			runnerRssBytes: process.memoryUsage().rss,
			profile: 'focused Chromium headless Node'
		})
	);
}, 30_000);

test('NativeVideoRecorderService record preserves failed diagnostics and releases context and lock', async () => {
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

test('NativeVideoRecorderService record refuses overlapping slot ownership', async () => {
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

function decodedRgbFrames(path: string): Buffer {
	const child = spawnSync(
		'ffmpeg',
		[
			...['-v', 'error', '-threads', '1', '-i', path, '-vf', 'format=rgb24,crop=1:1:75:75'],
			...['-frames:v', '450', '-threads', '1', '-filter_threads', '1', '-fps_mode', 'passthrough'],
			...['-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']
		],
		{ timeout: 20_000, maxBuffer: 10_000 }
	);
	expect(child.status, child.stderr?.toString()).toBe(0);
	return child.stdout;
}
