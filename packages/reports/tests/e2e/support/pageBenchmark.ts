import { expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { servedBuild } from './harnessCapture';
import { recordCapture } from '../../../../../src/utils/record-capture/recordCapture';
import { benchmarkCaptureSchema } from '../../../../../src/core/verification-evidence/verifyTypes';
import type { Gathered } from '../../../../../src/utils/verification-evidence/gatherCaptures';

/** Every rendered page has real navigation and heap observations at each required viewport. */
export function expectPageMeasurements(
	gathered: Gathered[],
	pages: string[],
	viewports: Array<{ width: number; height: number }>
): void {
	const benchmarks = gathered.filter((item) => item.line.kind === 'benchmark');
	const rows = benchmarks.flatMap(
		(item) => benchmarkCaptureSchema.parse(item.benchmark).measurements
	);
	const capturedStates = new Set(
		gathered
			.filter((item) => item.line.kind !== 'benchmark')
			.map(({ line }) =>
				line.kind === 'screenshot' ? `${line.state}-${line.viewport}` : line.state
			)
	);
	for (const item of benchmarks)
		expect(capturedStates.has(item.line.state), item.line.file).toBe(true);
	if (!process.env.HARNESS_VERIFY_REVISION || process.env.TAKE_SCREENSHOT !== '1') {
		expect(benchmarks).toHaveLength(0);
		return;
	}
	for (const row of rows) {
		expect(['browser-navigation-ms', 'browser-js-heap-bytes']).toContain(row.metric);
		expect(row.unitOfMeasure).toBe(row.metric === 'browser-navigation-ms' ? 'ms' : 'bytes');
		expect(row.value).toBeGreaterThan(0);
		expect(row.target).toBe('http');
		expect(row.samples).toBeGreaterThan(0);
		expect(row.method).toMatch(/whole (?:route|page)/i);
	}
	for (const viewport of viewports)
		for (const unit of new Set(pages))
			for (const metric of ['browser-navigation-ms', 'browser-js-heap-bytes'])
				expect(
					rows.some(
						(row) =>
							row.unit === unit &&
							row.metric === metric &&
							row.workload?.endsWith(`-${viewport.width}x${viewport.height}`)
					),
					`${unit} ${metric} ${viewport.width}x${viewport.height}`
				).toBe(true);
}
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
		'function.explorer-route',
		'reports.component.harness-entity-summary',
		'reports.function.entity-measure',
		'reports.function.entity-shown',
		'reports.function.explorer-evidence',
		'reports.function.explorer-evidence-focused-captures'
	];
	if (page === 'reports.page.harness-branch-branch-at-styles')
		return [
			page,
			'function.explorer-route',
			'reports.component.harness-screen',
			'reports.component.harness-harness-console',
			'reports.component.explorer-ui-harness-explorer-styles-screen',
			'reports.function.harness-icons',
			'reports.function.harness-shell',
			'reports.style.explorer',
			'reports.style.explorer-navbar',
			'reports.style.explorer-styles'
		];
	if (/-(pages|shells|components)-entity$/.test(page))
		units.push(
			'reports.component.harness-entity-screens',
			'reports.function.entity-screens',
			'reports.component.harness-entity-frame'
		);
	return units.filter((unit) =>
		existsSync(join(import.meta.dirname, '../../../../../specification/units', unit + '.json'))
	);
}

/** The registered framework page of this exact route. */
export function pageUnit(address: string): string | undefined {
	if (/^\/harness\/commit\/[a-f0-9]{40}(?:\/|$)/.test(new URL(address).pathname))
		return 'reports.page.harness-view';
	const match =
		/^\/harness\/branch\/[^/]+\/(?:commit\/[a-f0-9]{40}\/)?(pages|shells|components|functions|configs|services|models|styles)(\/[^/]+)?(\/(?:history|details))?$/.exec(
			new URL(address).pathname
		);
	if (!match) return;
	const unit = `reports.page.harness-branch-branch-at-${match[1]}${match[2] ? '-entity' : ''}${match[3] ? '-' + match[3].slice(1) : ''}`;
	return existsSync(join(import.meta.dirname, '../../../../../specification/units', unit + '.json'))
		? unit
		: undefined;
}
