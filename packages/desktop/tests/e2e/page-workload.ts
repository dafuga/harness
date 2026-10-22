import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioManifest, ComponentManifest } from '../../../../src/core/unitTypes';
import { BrowserProfileAdapter } from '../../../../src/adapters/development-tooling/BrowserProfileAdapter';

/** Observe a document navigation and its settled renderer heap for the matching page. */
export async function pageWorkload(
	page: Page,
	scenario: ScenarioManifest,
	capture: { state: string; name: string; viewport: string; buildId: string }
): Promise<void> {
	const units = scenario.units.filter((id) => pageAt(id, new URL(page.url()).pathname));
	const size = page.viewportSize()!;
	const browser = new BrowserProfileAdapter({
		navigation: () =>
			page.evaluate(() => {
				const item = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
				return item ? { name: item.name, duration: item.duration } : null;
			}),
		url: () => page.url(),
		heap: async () => (await pageHeap(page)).usedSize,
		viewport: () => size
	});
	await browser.capture({
		units,
		evidence: scenario.evidence.find(
			(item) => item.kind === 'benchmark' && item.states.includes(capture.state)
		)?.id,
		state: capture.state,
		workload: `${capture.state}-${size.width}x${size.height}`,
		file: `${capture.state}-${capture.name}-${capture.viewport}-benchmark.json`,
		viewport: capture.viewport,
		buildId: capture.buildId
	});
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
