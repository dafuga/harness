import { expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { evidenceRequested, recordCapture } from '../../../src/utils/record-capture/recordCapture';

/** Keeps what the page shows, when a run asks for screenshots; the name says what and how wide. */
export async function capture(page: Page, name: string, units: string[] = []): Promise<void> {
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
	keepCapture(pixels, name, units, observed);
}

function keepCapture(
	pixels: Uint8Array,
	name: string,
	units: string[],
	observed: { navigationMs: number | null; rendererJsHeapBytes: number | null }
): void {
	if (!evidenceRequested() || !units.length) return;
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Missing captured source revision');
	const home = process.env.ENTITY_PREVIEW_HOME ?? '/tmp/harness-entity-preview';
	const buildId = createHash('sha256')
		.update(readFileSync(join(home, 'preview.iife.js')))
		.digest('hex');
	for (const unit of units)
		recordCapture(
			{
				evidence: unit,
				kind: 'screenshot',
				state: name,
				file: `${name}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision: revision! },
				note: 'Actual shared explorer UI over the standard synthetic orders history; not a live project run.'
			},
			pixels
		);
	const measurements = units.flatMap((unit) =>
		Object.entries(observed)
			.filter(([, value]) => value !== null)
			.map(([metric, value]) => ({
				unit,
				workload: name,
				target: 'browser',
				samples: 1,
				metric: metric === 'navigationMs' ? 'navigation-ms' : 'renderer-js-heap-bytes',
				unitOfMeasure: metric === 'navigationMs' ? 'ms' : 'bytes',
				value,
				method:
					'Browser Navigation Timing and whole-renderer JavaScript heap after fonts and images settle; includes shared code and fixtures, not isolated component allocation.'
			}))
	);
	recordCapture(
		{
			evidence: 'entity-preview-workloads',
			kind: 'benchmark',
			state: name,
			file: `${name}.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
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
