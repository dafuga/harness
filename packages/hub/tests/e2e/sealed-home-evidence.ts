import type { Locator, Page } from '@playwright/test';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';
import manifest from '../../../../specification/scenarios/hub-home.json' with { type: 'json' };

export async function sealedHomeEvidence(
	page: Page,
	state: string,
	path: (name: string) => string
) {
	const registered = evidenceRequested();
	if (!registered && !process.env.TAKE_SCREENSHOT) return;
	for (const viewport of manifest.viewports) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all(Array.from(document.images, (image) => image.decode()));
			await new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			);
		});
		const file = `hub-home-${state}-${viewport.id}.png`;
		const bytes = await page.screenshot({
			fullPage: true,
			animations: 'disabled',
			caret: 'hide',
			path: path(file)
		});
		if (registered) await recordSealedHome(page, { file, state, viewport: viewport.id }, bytes);
	}
}

async function recordSealedHome(
	page: Page,
	location: { file: string; state: string; viewport: string },
	bytes: Buffer
) {
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!buildId || !revision) throw new Error('Sealed Home captures need the verified build stamp.');
	recordCapture(
		{
			...location,
			evidence: 'home-screen',
			kind: 'screenshot',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision }
		},
		bytes
	);
}

export async function measureSealedHome(page: Page, button: Locator, transcript: string) {
	const measurement = await button.evaluate(async (element, expected) => {
		const samples = [];
		for (let sample = 0; sample < 30; sample++) {
			(element as HTMLButtonElement).click();
			await new Promise(requestAnimationFrame);
			const start = performance.now();
			(element as HTMLButtonElement).click();
			await new Promise(requestAnimationFrame);
			await new Promise(requestAnimationFrame);
			if (document.querySelector('[aria-label="Transcript"]')?.textContent !== expected)
				throw new Error('Transcript was not visible at the timing checkpoint');
			samples.push(performance.now() - start);
		}
		samples.sort((a, b) => a - b);
		return { p50: samples[14], p95: samples[28], samples };
	}, transcript);
	const cdp = await page.context().newCDPSession(page);
	const heap = await cdp.send('Runtime.getHeapUsage');
	return { ...measurement, rendererHeapBytes: heap.usedSize };
}
