import type { Page } from '@playwright/test';
import { recordCapture } from '../../../../../../src/utils/record-capture/recordCapture';
import { previewState } from './catalogUnits';

/** The actual document that mounted this route, never a preceding soft-navigation document. */
export async function previewNavigation(page: Page, unit: string, viewport: string) {
	const navigation = await page.evaluate(() => {
		const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
		return entry
			? {
					document: window.previewDocument,
					timeOrigin: performance.timeOrigin,
					duration: entry.duration
				}
			: null;
	});
	if (
		navigation?.document?.unit !== unit ||
		navigation.document.timeOrigin !== navigation.timeOrigin
	)
		throw new Error(`The loaded preview document does not belong to ${unit}`);
	if (!navigation || !(navigation.duration > 0))
		throw new Error('Missing preview navigation timing');
	const session = await page.context().newCDPSession(page);
	const heap = await session.send('Runtime.getHeapUsage');
	await session.detach();
	if (!(heap.usedSize > 0)) throw new Error(`Missing settled preview heap for ${unit}`);
	const size = page.viewportSize()!;
	const common = {
		unit,
		workload: `route-preview-document-${size.width}x${size.height}`,
		target: 'http',
		samples: 1
	};
	const measurements = [
		{
			...common,
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: navigation.duration,
			method:
				'Chromium NavigationTiming through loadEventEnd for the preview document mounting the actual route component. Includes fixture/bootstrap; excludes real application backend and SSR cost.'
		},
		{
			...common,
			metric: 'browser-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: heap.usedSize,
			method:
				'Chromium used JavaScript heap after route preview fonts and images settled. Whole page including fixture and shared runtime; not isolated component memory or browser-process RSS.'
		}
	];
	const state = previewState(unit);
	recordCapture(
		{
			evidence: 'page-benchmarks',
			kind: 'benchmark',
			state,
			file: `${state}-${viewport}-navigation.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
