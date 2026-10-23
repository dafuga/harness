import type { Page } from '@playwright/test';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';
import { buildStamp } from '../../../../src/utils/development-tooling/buildStamp';
import { gameRuntimeMeasurements, gameSourceMeasurements } from './game-measurements-fixture';

/** Retain real document timing, contextual renderer heap and visible level-planning components. */
export async function recordLevelCapture(page: Page, state: string, bytes: Buffer) {
	if (!/^level-(entry|concept|brief|review|approved|built|stale)-(2d|3d)$/.test(state)) return;
	const size = page.viewportSize()!;
	const viewport = ({ 1440: 'desktop', 920: 'tablet', 390: 'mobile' } as Record<number, string>)[
		size.width
	];
	if (!viewport) return;
	const units = ['desktop.page.game'];
	for (const name of [
		'game-workspace',
		'game-view-fields',
		'game-graph',
		'game-level-plan',
		'game-level-brief',
		'game-level-review',
		'game-level-preview'
	])
		if (await page.locator('[data-harness-component="' + name + '"]').isVisible())
			units.push('desktop.component.' + name);
	const facts = await page.evaluate(() => ({
		elapsed: performance.now(),
		navigation:
			performance.getEntriesByType('navigation').find((e) => e.name === location.href)?.duration ??
			null,
		stamp: document.querySelector('meta[name="harness-build"]')?.getAttribute('content')
	}));
	const cdp = await page.context().newCDPSession(page),
		heap = await cdp.send('Runtime.getHeapUsage');
	await cdp.detach();
	const measurements = [
		...gameRuntimeMeasurements({
			...facts,
			units,
			heap: heap.usedSize,
			workload: state + '-' + viewport
		}),
		...(await gameSourceMeasurements(process.env.HARNESS_VERIFY_REVISION, units))
	];
	recordCapture(
		{
			evidence: 'level-planning-workload',
			kind: 'benchmark',
			state,
			viewport,
			file: state + '-' + viewport + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
	recordLevelScreenshot(state, viewport, facts.stamp, bytes);
}

function recordLevelScreenshot(
	state: string,
	viewport: string,
	stamp: string | null | undefined,
	bytes: Buffer
) {
	const buildId = buildStamp(stamp ?? undefined),
		revision = process.env.HARNESS_VERIFY_REVISION;
	if (buildId && revision)
		recordCapture(
			{
				evidence: 'level-planning-screens',
				kind: 'screenshot',
				state,
				viewport,
				file: state + '-' + viewport + '.png',
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision },
				note: 'Compiled app; deterministic saved-project model fixture, no live inference.'
			},
			bytes
		);
}
