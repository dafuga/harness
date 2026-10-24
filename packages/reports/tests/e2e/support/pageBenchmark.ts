import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { servedBuild } from './harnessCapture';
import { recordCapture } from '../../../../../src/utils/record-capture/recordCapture';
import { benchmarkCaptureSchema } from '../../../../../src/core/verification-evidence/verifyTypes';
import type { Gathered } from '../../../../../src/utils/verification-evidence/gatherCaptures';

const unitsDirectory = join(import.meta.dirname, '../../../../../specification/units');
const registered = (id: string) =>
	JSON.parse(readFileSync(join(unitsDirectory, `${id}.json`), 'utf8')) as {
		dependencies: Array<{ unit: string }>;
	};

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
			measurements: (await includedUnits(page, unit)).flatMap((unit) =>
				measurements.map((measurement) => ({ ...measurement, unit }))
			)
		})
	);
}

/**
 * A route workload includes the units it drew and the route code it ran; these figures never
 * claim isolation. What is drawn is observed, so a piece the route did not draw is not credited.
 */
async function includedUnits(page: Page, route: string): Promise<string[]> {
	const ran = [
		'function.explorer-route',
		'reports.function.entity-measure',
		'reports.function.entity-shown',
		'reports.function.explorer-evidence',
		'reports.function.explorer-evidence-focused-captures'
	];
	if (route === 'reports.page.harness-branch-branch-at-styles')
		ran.push(
			'reports.style.explorer-styles',
			'reports.style.app-tokens',
			'reports.style.explorer',
			'reports.style.explorer-navbar',
			'reports.function.harness-icons',
			'reports.function.harness-shell'
		);
	const screened = /-(pages|shells|components)-entity$/.test(route);
	if (screened) ran.push('reports.function.entity-screens');
	const units = new Set([route, ...ran, ...(await shownUnits(page, true))]);
	return [...units].filter((unit) => existsSync(join(unitsDirectory, unit + '.json')));
}

/**
 * The registered units a settled screen draws: its route page, the screen and host that page's
 * markup consists of, and each piece whose marker is drawn in the window (anywhere, when `whole`).
 * Nothing below the route is inferred from imports: importing a piece does not draw it.
 */
export async function shownUnits(page: Page, whole = false): Promise<string[]> {
	const route = pageUnit(page.url());
	const mounted = route
		? registered(route).dependencies.filter(({ unit }) => unit.startsWith('reports.component.'))
		: [];
	const marked = await page.evaluate(markersInView, whole);
	const units = [
		...(route ? [route] : []),
		...mounted.map(({ unit }) => unit),
		...marked.map((name) => `reports.component.${name}`)
	];
	return [...new Set(units)].sort();
}

/** Runs in the page: the name of each component marker drawn in the window, or anywhere. */
function markersInView(whole: boolean): string[] {
	const boxOf = (element: Element): DOMRect => {
		if (getComputedStyle(element).display !== 'contents') return element.getBoundingClientRect();
		// A marker that draws no box of its own stands for the boxes of what it holds.
		const parts = [...element.children].map(boxOf).filter((box) => box.width * box.height > 0);
		if (parts.length === 0) return new DOMRect();
		const left = Math.min(...parts.map((box) => box.left));
		const top = Math.min(...parts.map((box) => box.top));
		const right = Math.max(...parts.map((box) => box.right));
		const bottom = Math.max(...parts.map((box) => box.bottom));
		return new DOMRect(left, top, right - left, bottom - top);
	};
	// In the window: at least half of what of it could fit there is inside it, and it is not hidden.
	const drawn = (element: Element) => {
		const box = boxOf(element);
		const style = getComputedStyle(element);
		if (box.width * box.height === 0 || style.visibility === 'hidden' || style.opacity === '0')
			return false;
		const width = Math.max(0, Math.min(box.right, innerWidth) - Math.max(box.left, 0));
		const height = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0));
		const fits = Math.min(box.width * box.height, innerWidth * innerHeight);
		return whole || width * height >= fits / 2;
	};
	const marked = [...document.querySelectorAll('[data-harness-component]')].filter(drawn);
	const names = marked.map((element) => element.getAttribute('data-harness-component') ?? '');
	return [...new Set(names)];
}

/** The registered framework page of this exact route. */
export function pageUnit(address: string): string | undefined {
	if (/^\/harness\/commit\/[a-f0-9]{40}(?:\/|$)/.test(new URL(address).pathname))
		return 'reports.page.harness-view';
	const match =
		/^\/harness\/branch\/[^/]+\/(?:commit\/[a-f0-9]{40}\/)?(pages|shells|components|functions|configs|services|models|styles|agents)(\/[^/]+)?(\/(?:history|details))?$/.exec(
			new URL(address).pathname
		);
	if (!match) return;
	const unit = `reports.page.harness-branch-branch-at-${match[1]}${match[2] ? '-entity' : ''}${match[3] ? '-' + match[3].slice(1) : ''}`;
	return existsSync(join(unitsDirectory, unit + '.json')) ? unit : undefined;
}
