import { expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { servedBuild } from './harnessCapture';
import { recordCapture } from '../../../../../src/utils/record-capture/recordCapture';
/** Runtime observations of the real route, never of a later client-side destination. */
export async function pageBenchmark(page: Page, state: string, unit?: string): Promise<void> {
	if (!unit) return;
	const server = await servedBuild(page);
	if (!server || server.revision !== process.env.HARNESS_VERIFY_REVISION) return;
	const navigation = await page.evaluate(() => {
		const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
		return entry ? { name: entry.name, duration: entry.duration } : null;
	});
	// A soft navigation has no new NavigationTiming entry; do not borrow its predecessor's time.
	if (!navigation || navigation.name !== page.url()) return;
	const session = await page.context().newCDPSession(page);
	const heap = await session.send('Runtime.getHeapUsage');
	await session.detach();
	expect(navigation.duration).toBeGreaterThan(0);
	expect(heap.usedSize).toBeGreaterThan(0);
	const viewport = page.viewportSize()!;
	const context = {
		unit,
		workload: `${state}-${viewport.width}x${viewport.height}`,
		target: 'http',
		samples: 1
	};
	const measurements = [
		{
			...context,
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: navigation.duration,
			method: `Whole route Chromium NavigationTiming through loadEventEnd, including shared units without isolated attribution; ${viewport.width}x${viewport.height}; build ${server.buildId}.`
		},
		{
			...context,
			metric: 'browser-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: heap.usedSize,
			method:
				'Chromium Runtime.getHeapUsage after fonts and images settled; whole page JavaScript heap including shared code, not isolated unit memory or browser-process RSS.'
		}
	];
	recordCapture(
		{
			evidence: 'page-benchmarks',
			state,
			kind: 'benchmark',
			file: `${state}-benchmark.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({
			measurements: includedUnits(unit).flatMap((unit) =>
				measurements.map((measurement) => ({ ...measurement, unit }))
			)
		})
	);
}

/** A route workload includes its rendered shared units; these figures never claim isolation. */
function includedUnits(page: string): string[] {
	const units = [
		page,
		'reports.component.harness-entity-header',
		'reports.component.harness-entity-summary',
		'reports.function.entity-measure',
		'reports.function.entity-shown',
		'reports.function.explorer-evidence',
		'reports.function.explorer-evidence-focused-captures'
	];
	if (/-(pages|shells|components)-entity$/.test(page))
		units.push('reports.component.harness-entity-screens', 'reports.function.entity-screens');
	return units.filter((unit) =>
		existsSync(join(import.meta.dirname, '../../../../../specification/units', unit + '.json'))
	);
}
