import { expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { BuildIdentityService } from '../../../src/services/BuildIdentityService';
import { recordCapture } from '../../../src/utils/record-capture/recordCapture';
import { unitIdPattern } from '../../../src/core/unitTypes';
import { previewHome } from './entityPreviewSetup';
import { capturePlatformEvidence } from './entityPreviewPlatformEvidence';

/** The compiled fixture files served by entityPreviewPage, independently of its synthetic history. */
export async function previewIdentity() {
	const built = await new BuildIdentityService().identify(previewHome());
	if (!built) throw new Error('The entity preview build is missing.');
	return {
		buildId: built.buildId,
		revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
	};
}

/** Keeps what the page shows, when a run asks for screenshots; the name says what and how wide. */
export async function capture(
	page: Page,
	name: string,
	units = ['reports.component.harness-explorer-content']
): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== '1') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise(requestAnimationFrame);
		await new Promise(requestAnimationFrame);
	});
	await ready(page);
	await expect(page.locator('.ex-content')).toBeVisible();
	const directory = process.env.ENTITY_PREVIEW_SHOTS ?? '/tmp/harness-entity-preview-shots';
	mkdirSync(directory, { recursive: true });
	const pixels = await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
	await retain(page, { name, units, pixels });
	await capturePlatformEvidence(page, name, pixels);
	const observed = await page.evaluate(() => {
		const navigation = performance.getEntriesByType('navigation')[0] as
			| PerformanceNavigationTiming
			| undefined;
		const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
		return {
			navigationMs: navigation?.duration ?? null,
			rendererJsHeapBytes: memory?.usedJSHeapSize ?? null
		};
	});
	writeFileSync(
		join(directory, `${name}.json`),
		JSON.stringify({
			revision: process.env.HARNESS_VERIFY_REVISION ?? null,
			viewport: page.viewportSize(),
			fixture: 'Synthetic orders; actual shared explorer UI',
			state: name,
			sha256: createHash('sha256').update(pixels).digest('hex'),
			method:
				'Browser Navigation Timing; whole-renderer JavaScript heap, not individual component allocation',
			...observed
		})
	);
}

/** Explicit units are the real UI exercised by the caller, never the synthetic entities pictured. */
async function retain(page: Page, capture: { name: string; units: string[]; pixels: Buffer }) {
	if (!process.env.HARNESS_EVIDENCE_DIR) return;
	const server = await page.evaluate(
		() =>
			(window as unknown as { previewBuild?: { buildId: string; revision: string } }).previewBuild
	);
	expect(server, 'the page reports the compiled fixture it actually served').toEqual(
		await previewIdentity()
	);
	const state = capture.name.toLowerCase().replace(/[^a-z0-9.-]+/g, '-');
	const size = page.viewportSize()!;
	let viewport = 'tablet';
	if (size.width >= 1200) viewport = 'desktop';
	if (size.width <= 480) viewport = 'mobile';
	const measurements = await observations(page, `${state}-${size.width}x${size.height}`);
	for (const unit of new Set(capture.units)) {
		assertVisualUnit(unit);
		const line = { evidence: unit, state, viewport, server };
		recordCapture(
			{
				...line,
				kind: 'screenshot',
				file: `${unit}-${state}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				note: 'Real shared UI over a synthetic history; not a capture of the fictional entity.'
			},
			capture.pixels
		);
		recordCapture(
			{ ...line, kind: 'benchmark', file: `${unit}-${state}.json`, mediaType: 'application/json' },
			JSON.stringify({ measurements: measurements.map((row) => ({ ...row, unit })) })
		);
	}
}

function assertVisualUnit(unit: string) {
	if (!unitIdPattern.test(unit)) throw new Error(`Invalid capture unit: ${unit}`);
	const path = join(import.meta.dirname, '../../../specification/units', `${unit}.json`);
	const registered = JSON.parse(readFileSync(path, 'utf8')) as { kind: string; status: string };
	if (registered.status !== 'active' || !['page', 'component', 'shell'].includes(registered.kind))
		throw new Error(`Capture unit must be an active visual module: ${unit}`);
}

/** Document navigation and current renderer heap are contextual workloads, not isolated allocations. */
async function observations(page: Page, workload: string) {
	const timing = await page.evaluate(() => {
		const first = (window as unknown as { previewInitialUrl: string }).previewInitialUrl;
		const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
		return first === location.href ? navigation?.duration : undefined;
	});
	const session = await page.context().newCDPSession(page);
	const heap = await session.send('Runtime.getHeapUsage');
	await session.detach();
	const context = { workload, target: 'http', samples: 1 };
	return [
		{
			...context,
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: timing && timing > 0 ? timing : null,
			...(!(timing && timing > 0)
				? { unavailable: 'No fresh document navigation for this UI state.' }
				: {}),
			method:
				'Whole fixture document NavigationTiming; shared code included, not isolated component latency.'
		},
		{
			...context,
			metric: 'browser-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: heap.usedSize,
			method:
				'Whole page Chromium Runtime.getHeapUsage after images and fonts settled; shared code included, not isolated component allocation.'
		}
	];
}
/** Wait for the visible capture to render without forcing offscreen lazy images to load. */
export async function ready(page: Page): Promise<void> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		const visible = [...document.images].filter((image) => {
			const box = image.getBoundingClientRect();
			return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
		});
		await Promise.all(visible.map((image) => image.decode()));
	});
}
