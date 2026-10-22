import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioManifest, ComponentManifest } from '../../../../src/core/unitTypes';
import { BrowserProfileAdapter } from '../../../../src/adapters/development-tooling/BrowserProfileAdapter';
import { evidenceRequested } from '../../../../src/utils/record-capture/recordCapture';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { randomUUID } from 'node:crypto';

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

/** Observe the declared participants of one real UI action, including its readiness assertions. */
export async function workflowWorkload(
	page: Page,
	shown: { units: string[]; name: string; state?: string },
	operation: () => Promise<void>
) {
	const size = page.viewportSize()!;
	const browser = new BrowserProfileAdapter({
		navigation: async () => null,
		url: () => page.url(),
		viewport: () => size,
		heap: async () => (await pageHeap(page)).usedSize,
		identity: async () =>
			buildStamp(
				(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
			)
	});
	await browser.capture(
		{
			units: shown.units,
			evidence: 'desktop-workflow-benchmarks',
			state: shown.state ?? 'renderer-fixtures',
			workload: `${shown.name}-${size.width}x${size.height}`,
			file: `${shown.name}-${size.width}x${size.height}-${randomUUID()}.json`,
			note: 'Actual compiled viewer over the test fixture bridge. Shared browser workflow time and renderer JavaScript heap include fixture, readiness and protocol overhead; no isolated component cost or backend performance.'
		},
		async () => {
			await operation();
			if (!evidenceRequested()) return;
			await page.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
				await new Promise(requestAnimationFrame);
				await new Promise(requestAnimationFrame);
			});
			await page.mouse.move(0, 0);
		}
	);
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
