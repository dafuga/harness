import type { Page } from '@playwright/test';
import { performance } from 'node:perf_hooks';
import { median } from '../../../../../../src/utils/benchSamples';
import { recordCapture } from '../../../../../../src/utils/record-capture/recordCapture';
import { readyPreview } from './previewPage';
import { previewState } from './catalogUnits';
/** Profiles a real remount and settled render, including fixture and browser-protocol overhead. */
export async function profilePreview(page: Page, unit: string) {
	const workload = 'representative-browser-mount';
	const elapsed: number[] = [];
	for (let round = 0; round < 6; round++) {
		const started = performance.now();
		await page.evaluate(() => window.previewRemount());
		await readyPreview(page, unit);
		if (round > 0) elapsed.push(performance.now() - started);
	}
	const measurements = [
		{
			unit,
			workload,
			target: 'module',
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: median(elapsed),
			samples: elapsed.length,
			method:
				'Median of five real Chromium remounts after one warmup. Includes fixture, settling and browser-protocol overhead; not isolated component latency.'
		}
	];
	const session = await page.context().newCDPSession(page);
	await session.send('HeapProfiler.collectGarbage');
	const heap = await session.send('Runtime.getHeapUsage');
	await session.detach();
	if (!(heap.usedSize > 0)) throw new Error(`No browser heap observation for ${unit}`);
	measurements.push({
		unit,
		workload,
		target: 'module',
		metric: 'memory-bytes',
		unitOfMeasure: 'bytes',
		value: heap.usedSize,
		samples: 1,
		method:
			'Chromium used JavaScript heap after the representative render and explicit garbage collection. Includes the fixture and Svelte runtime; not incremental allocation or peak RSS.'
	});
	recordCapture(
		{
			evidence: 'profiles',
			kind: 'benchmark',
			state: previewState(unit),
			file: `${previewState(unit)}-profile.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
