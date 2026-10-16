import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { recordCapture } from '../../../../src/utils/recordCapture';
import { buildStamp } from '../../../../src/utils/buildStamp';

/** The viewports the scenario `remote-mobile-ui` names; a capture of any other size is refused. */
const viewports: Record<string, string> = {
	'1440x900': 'desktop',
	'390x844': 'mobile',
	'820x1180': 'tablet'
};
const note =
	'Actual compiled renderer with a SYNTHETIC control port or native plugin in the page. No relay, host computer, phone, key or credential exists; this is no proof of a connection.';

/** What is shown has settled: fonts are loaded and every image decoded. A broken image fails. */
async function settled(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
}

/**
 * The opt-in screenshot of a test run, taken only once what is shown is ready: fonts loaded,
 * images decoded, and the part that is named scrolled into view. Nothing is written otherwise.
 */
export async function captured(
	page: Page,
	info: TestInfo,
	name: string,
	part?: Locator
): Promise<void> {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await part?.scrollIntoViewIfNeeded();
	await settled(page);
	await page.screenshot({
		path: info.outputPath(`${name}.png`),
		animations: 'disabled',
		caret: 'hide'
	});
}

/**
 * Records one state of the remote UI as source-bound evidence when a verification asks for it:
 * the pixels of the stamped build at the verified revision, under the exact state and viewport
 * of the scenario. Without a stamp, a revision or a known viewport the test fails; nothing is
 * substituted. Outside a verification it only writes the opt-in screenshot of a test run.
 */
export async function remoteEvidence(page: Page, info: TestInfo, state: string): Promise<void> {
	if (process.env.TAKE_SCREENSHOT === 'true') await captured(page, info, state);
	if (!process.env.HARNESS_EVIDENCE_DIR) return;
	await settled(page);
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	const size = page.viewportSize();
	const viewport = viewports[`${size?.width}x${size?.height}`];
	expect(buildId, 'The rendered compiled renderer must carry its build identity').toBeTruthy();
	expect(revision, 'Evidence must identify the verification revision').toMatch(/^[a-f0-9]{40}$/);
	expect(viewport, 'Evidence needs a viewport the scenario names').toBeTruthy();
	recordCapture(
		{
			evidence: `remote-screens-${viewport}`,
			kind: 'screenshot',
			state,
			viewport,
			file: `remote-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId: buildId!, revision: revision! },
			note
		},
		await page.screenshot({ animations: 'disabled', caret: 'hide' }),
		{ HARNESS_EVIDENCE_DIR: process.env.HARNESS_EVIDENCE_DIR, TAKE_SCREENSHOT: '1' }
	);
}
