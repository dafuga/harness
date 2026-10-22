import type { Page } from '@playwright/test';
import { BuildIdentityService } from '../../../src/services/BuildIdentityService';
import { evidenceRequested, recordCapture } from '../../../src/utils/record-capture/recordCapture';
import { previewHome } from './entityPreviewSetup';

/** Start a measured client route transition immediately before its normal user action. */
export async function startRoute(page: Page): Promise<void> {
	await page.evaluate(() => {
		performance.clearMarks('entity-preview-route-start');
		performance.mark('entity-preview-route-start');
	});
}

const listUnits = [
	'reports.page.harness-branch-branch-at-platforms',
	'reports.component.explorer-ui-explorer-platforms',
	'reports.component.harness-explorer-controls',
	'reports.component.harness-explorer-frame',
	'reports.component.harness-explorer-content',
	'reports.function.harness-shell',
	'reports.function.harness-icons',
	'reports.function.entity-lens',
	'reports.style.platforms',
	'reports.function.explorer-ui-explorer-platforms-platform-status'
];
const detailUnits = [
	'reports.page.harness-branch-branch-at-platforms-entity',
	'reports.component.explorer-ui-explorer-platform-details'
];

/** Retain the actual fixture build, original pixels and whole-page observations in Harness. */
export async function capturePlatformEvidence(
	page: Page,
	name: string,
	pixels: Buffer
): Promise<void> {
	const match =
		/^platforms-(entry|list|web|ios|android|desktop|missing|status-filter)-(desktop|tablet|mobile)$/.exec(
			name
		);
	if (!match || !evidenceRequested()) return;
	const [, state, viewport] = match;
	const served = await new BuildIdentityService().identify(previewHome());
	if (!served) throw new Error('The platform preview build is missing.');
	let units = detailUnits;
	if (state === 'entry') units = ['reports.component.harness-harness-navbar'];
	else if (['list', 'status-filter'].includes(state)) units = listUnits;
	recordCapture(
		{
			evidence: state === 'status-filter' ? 'platform-filter-screen' : 'platform-screens',
			kind: 'screenshot',
			state,
			viewport,
			file: `${name}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId: served.buildId, revision: process.env.HARNESS_VERIFY_REVISION! },
			note: 'Synthetic Orders project; actual shared Explorer UI, not a deployed application.'
		},
		pixels
	);
	const measurements = await platformMeasurements(page, units, state, viewport);
	recordCapture(
		{
			evidence: 'platform-measurements',
			kind: 'benchmark',
			state,
			viewport,
			file: `${name}-measurements.json`,
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}

async function platformMeasurements(page: Page, units: string[], state: string, viewport: string) {
	const duration = await page.evaluate(() => {
		const start = performance.getEntriesByName('entity-preview-route-start').at(-1)?.startTime ?? 0;
		return performance.now() - start;
	});
	const session = await page.context().newCDPSession(page);
	const heap = await session.send('Runtime.getHeapUsage');
	await session.detach();
	const context = { workload: `platform-${state}-${viewport}`, target: 'browser', samples: 1 };
	return units.flatMap((unit) => [
		{
			...context,
			unit,
			metric: 'route-ready-ms',
			unitOfMeasure: 'ms',
			value: duration,
			method:
				'Elapsed from the user route action (or document start) through settled fonts, layout and capture; includes shared UI and screenshot overhead.'
		},
		{
			...context,
			unit,
			metric: 'page-js-heap-bytes',
			unitOfMeasure: 'bytes',
			value: heap.usedSize,
			method:
				'Chromium Runtime.getHeapUsage for the whole page after the route settles; includes shared code and fixtures, not isolated component allocation.'
		}
	]);
}
