import { BuildIdentityService } from '../../../src/services/BuildIdentityService';
import { recordCapture } from '../../../src/utils/record-capture/recordCapture';
/** Records only standardized catalog checkpoints against the exact compiled fixture files. */
export async function recordCatalogCapture(
	home: string,
	name: string,
	bytes: Uint8Array
): Promise<void> {
	const catalog = /^component-cards-(tip|bbbbbbb|aaaaaaa|reused)-(desktop|tablet|mobile)$/.exec(
		name
	);
	if (!catalog) return;
	const states: Record<string, string> = {
		tip: 'current',
		bbbbbbb: 'previous',
		aaaaaaa: 'initial',
		reused: 'inherited'
	};
	const built = await new BuildIdentityService().identify(home);
	if (!built) throw new Error('Component catalog preview build is missing.');
	recordCapture(
		{
			evidence: catalog[1] === 'reused' ? 'inherited-screens' : 'screens',
			kind: 'screenshot',
			state: states[catalog[1]],
			viewport: catalog[2],
			file: `${name}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: {
				buildId: built.buildId,
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
}

import { expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { previewHome } from './entityPreviewSetup';

/** Keeps what the page shows, when a run asks for screenshots; the name says what and how wide. */
export async function capture(page: Page, name: string): Promise<void> {
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
	await recordCatalogCapture(previewHome(), name, pixels);
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
