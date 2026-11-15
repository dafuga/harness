import { expect, type Page } from '@playwright/test';
import { recordCapture } from '../../../../../../src/utils/reports-media/record-capture/recordCapture';
import type { VideoPilotMeasurementTarget } from './videoPilotMeasurements.types';

/** Observe the settled document before native capture; these figures include its shared runtime. */
export async function videoPilotMeasurements(page: Page, target: VideoPilotMeasurementTarget) {
	const navigation = await page.evaluate(() => {
		const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
		return entry ? { name: entry.name, duration: entry.duration } : null;
	});
	expect(navigation?.name, 'measure this document rather than a preceding soft navigation').toBe(
		page.url()
	);
	expect(navigation!.duration).toBeGreaterThan(0);
	const session = await page.context().newCDPSession(page);
	const heap = await session.send('Runtime.getHeapUsage');
	await session.detach();
	expect(heap.usedSize).toBeGreaterThan(0);
	const { unit, clipId, state, buildId, viewport } = target;
	const context = {
		unit,
		workload: `video-${clipId}-${viewport.width}x${viewport.height}`,
		target: 'http',
		samples: 1
	};
	const measurements = [
		{
			...context,
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: navigation!.duration,
			method: `Whole document Chromium NavigationTiming through loadEventEnd, including fixture/shared units; build ${buildId}.`
		},
		{
			...context,
			metric: 'browser-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: heap.usedSize,
			method:
				'Chromium used JavaScript heap after fonts/images settled; whole document including fixture/shared runtime, not isolated unit memory or process RSS.'
		}
	];
	expect(
		recordCapture(
			{
				evidence: 'page-benchmarks',
				kind: 'benchmark',
				state,
				viewport: viewport.id,
				file: `metrics-${clipId}-${viewport.id}.json`,
				mediaType: 'application/json'
			},
			JSON.stringify({ measurements })
		),
		'the scoped pilot must retain its actual measurements'
	).toBe(true);
}
