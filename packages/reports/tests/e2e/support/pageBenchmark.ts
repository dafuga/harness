import type { Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { servedBuild } from './harnessCapture';
import { BrowserProfileAdapter } from '../../../../../src/adapters/development-tooling/BrowserProfileAdapter';
/** Runtime observations of the real route, never of a later client-side destination. */
export async function pageBenchmark(page: Page, state: string, unit?: string): Promise<void> {
	if (!unit) return;
	const server = await servedBuild(page);
	if (!server || server.revision !== process.env.HARNESS_VERIFY_REVISION) return;
	const browser = new BrowserProfileAdapter({
		navigation: () =>
			page.evaluate(() => {
				const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
				return entry ? { name: entry.name, duration: entry.duration } : null;
			}),
		url: () => page.url(),
		heap: async () => (await pageHeap(page)).usedSize,
		viewport: () => page.viewportSize()!
	});
	const viewport = page.viewportSize()!;
	await browser.capture({
		units: [unit],
		state,
		workload: `${state}-${viewport.width}x${viewport.height}`,
		file: `${state}-benchmark.json`,
		buildId: server.buildId
	});
}

async function pageHeap(page: Page) {
	const session = await page.context().newCDPSession(page);
	try {
		return await session.send('Runtime.getHeapUsage');
	} finally {
		await session.detach();
	}
}

/** The registered framework page of this exact route. */
export function pageUnit(address: string): string | undefined {
	const pathname = new URL(address).pathname;
	if (
		/^\/harness\/branch\/[^/]+\/(?:commit\/[a-f0-9]{40}\/)?helpers\/[^/]+(?:\/[^/]+)?$/.test(
			pathname
		)
	)
		return 'reports.page.harness-view';
	const match =
		/^\/harness\/branch\/[^/]+\/(?:commit\/[a-f0-9]{40}\/)?(pages|shells|components|functions|configs|services|models)(\/[^/]+)?(\/(?:history|details))?$/.exec(
			pathname
		);
	if (!match) return;
	const unit = `reports.page.harness-branch-branch-at-${match[1]}${match[2] ? '-entity' : ''}${match[3] ? '-' + match[3].slice(1) : ''}`;
	return existsSync(join(import.meta.dirname, '../../../../../specification/units', unit + '.json'))
		? unit
		: undefined;
}
