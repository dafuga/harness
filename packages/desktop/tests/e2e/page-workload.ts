import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioManifest, ComponentManifest } from '../../../../src/core/unitTypes';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';

type Context = {
	workload: string;
	target: string;
	samples: number;
	width: number;
	height: number;
	buildId: string;
};

/** Observe a document navigation and its settled renderer heap for the matching page. */
export async function pageWorkload(
	page: Page,
	scenario: ScenarioManifest,
	capture: { state: string; name: string; viewport: string; buildId: string }
): Promise<void> {
	const navigation = await page.evaluate(() => {
		const item = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
		return item ? { name: item.name, duration: item.duration } : null;
	});
	if (!navigation || navigation.name !== page.url()) return;
	const units = scenario.units.filter((id) => pageAt(id, new URL(page.url()).pathname));
	if (!units.length) return;
	const heap = await pageHeap(page);
	if (navigation.duration <= 0 || heap.usedSize <= 0)
		throw new Error('A required page workload has no positive navigation and heap readings.');
	const slot = scenario.evidence.find(
		(item) => item.kind === 'benchmark' && item.states.includes(capture.state)
	);
	const size = page.viewportSize()!;
	const measurements = pageReadings(
		units,
		{
			workload: `${capture.state}-${size.width}x${size.height}`,
			target: 'module',
			samples: 1,
			...size,
			buildId: capture.buildId
		},
		{ duration: navigation.duration, heap: heap.usedSize }
	);
	recordCapture(
		{
			evidence: slot?.id ?? 'page-benchmarks',
			kind: 'benchmark',
			state: capture.state,
			viewport: capture.viewport,
			file: `${capture.state}-${capture.name}-${capture.viewport}-benchmark.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}

/** Whole-renderer observations retain their scope instead of claiming isolated unit cost. */
function pageReadings(
	units: string[],
	context: Context,
	values: { duration: number; heap: number }
) {
	const { width, height, buildId, ...common } = context;
	return units.flatMap((unit) => [
		{
			...common,
			unit,
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: values.duration,
			method: `Whole compiled renderer NavigationTiming through loadEventEnd, including shared code; ${width}x${height}; build ${buildId}.`
		},
		{
			...common,
			unit,
			metric: 'browser-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: values.heap,
			method:
				'Chromium Runtime.getHeapUsage after fonts and images settled; whole renderer JavaScript heap, including shared code, not isolated unit memory or process RSS.'
		}
	]);
}

/** A settings slot on a project screen cannot time Settings; the declared route must match. */
function pageAt(id: string, pathname: string): boolean {
	const unit = JSON.parse(
		readFileSync(join(import.meta.dirname, '../../../../specification/units', id + '.json'), 'utf8')
	) as ComponentManifest;
	if (unit.kind !== 'page') return false;
	const route = unit.runtime.entry?.split('/src/routes/')[1]?.replace(/(^|\/)\+page\.svelte$/, '');
	if (route === undefined) return false;
	const parts = route.split('/').filter((part) => part && !/^\(.*\)$/.test(part));
	const pattern = parts
		.map((part) => {
			if (/^\[\.\.\./.test(part)) return '.+';
			if (/^\[\[/.test(part)) return '[^/]*';
			if (/^\[/.test(part)) return '[^/]+';
			return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		})
		.join('/');
	return new RegExp('^/' + pattern + '/?$').test(pathname);
}

async function pageHeap(page: Page) {
	const session = await page.context().newCDPSession(page);
	try {
		return await session.send('Runtime.getHeapUsage');
	} finally {
		await session.detach();
	}
}
