import type { Page } from '@playwright/test';
import { PerformanceProfileService } from '../../../../../../src/services/PerformanceProfileService';
import { recordCapture } from '../../../../../../src/utils/record-capture/recordCapture';
import { readyPreview } from './previewPage';
import { previewState } from './catalogUnits';
/** Profiles a real remount and settled render, including fixture and browser-protocol overhead. */
export async function profilePreview(page: Page, unit: string) {
	const workload = 'representative-browser-mount';
	const measurements = await new PerformanceProfileService().measure(
		{ unit, workload, rounds: 5, iterations: 1, warmups: 1 },
		async () => {
			await page.evaluate(() => window.previewRemount());
			await readyPreview(page, unit);
		}
	);
	measurements[0].method +=
		' Includes the Chromium remount, fixture context, settling and browser-protocol overhead.';
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
