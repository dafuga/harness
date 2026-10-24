import type { Page } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';
import { buildStamp } from '../../../../src/utils/development-tooling/buildStamp';
import { gameRuntimeMeasurements, gameSourceMeasurements } from './game-measurements-fixture';
const units = [
	'desktop.page.game',
	'desktop.component.game-workspace',
	'desktop.component.game-view-fields',
	'desktop.component.game-preview',
	'desktop.component.game-controls'
];
/** Capture the running planned level, separate from its non-playable proposal review. */
export async function captureLevelPlayback(page: Page, dimension: string) {
	if (!process.env.HARNESS_EVIDENCE_DIR) return;
	const width = page.viewportSize()!.width;
	const viewport = ({ 1440: 'desktop', 920: 'tablet', 390: 'mobile' } as Record<number, string>)[
		width
	];
	const state = 'level-play-' + dimension;
	await expect(page.locator('canvas[data-ready=true]')).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	const bytes = await page.screenshot({
		fullPage: true,
		path: 'test-results/' + state + '-' + viewport + '.png'
	});
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
			evidence: 'level-playback-workload',
			kind: 'benchmark',
			state,
			viewport,
			file: state + '-' + viewport + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
	recordPlayScreen(state, viewport, buildStamp(facts.stamp ?? undefined), bytes);
}
function recordPlayScreen(state: string, viewport: string, buildId: string | null, bytes: Buffer) {
	const revision = process.env.HARNESS_VERIFY_REVISION;
	if (!revision || !buildId) return;
	recordCapture(
		{
			evidence: 'level-playback-screens',
			kind: 'screenshot',
			state,
			viewport,
			file: state + '-' + viewport + '.png',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision },
			note: 'Compiled renderer running approved generated-layout fixture; no live inference in browser acceptance.'
		},
		bytes
	);
}
