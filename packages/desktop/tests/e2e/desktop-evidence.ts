import { expect, type Page } from '@playwright/test';
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';
import { buildStamp } from '../../../../src/utils/buildStamp';

/** Record real rendered pixels; fixture data does not claim a live provider run. */
export async function desktopEvidence(page: Page, state: string, native = false): Promise<void> {
	if (!process.env.HARNESS_EVIDENCE_DIR) return;
	if (native) await page.setViewportSize({ width: 1440, height: 900 });
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	expect(buildId, 'The rendered compiled renderer must carry its build identity').toBeTruthy();
	expect(revision, 'Evidence must identify the verification revision').toMatch(/^[a-f0-9]{40}$/);
	const width = page.viewportSize()?.width ?? (await page.evaluate(() => innerWidth));
	const viewport = width < 600 ? 'mobile' : width < 1000 ? 'tablet' : 'desktop';
	recordCapture(
		{
			evidence: `${native ? 'native-screens' : 'renderer-screens'}-${viewport}`,
			kind: 'screenshot',
			state,
			viewport,
			file: `${native ? 'native' : 'ui'}-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId: buildId!, revision: revision! },
			note: native
				? 'Actual compiled Electron renderer and IPC; disposable Git project, no live agent generation.'
				: 'Actual compiled browser renderer with deterministic fixture IPC; no live agent execution.'
		},
		await page.screenshot({ animations: 'disabled', caret: 'hide' }),
		{
			HARNESS_EVIDENCE_DIR: process.env.HARNESS_EVIDENCE_DIR,
			TAKE_SCREENSHOT: '1'
		}
	);
}

export async function checkpoint(page: Page, name: string) {
	await desktopEvidence(page, name, false);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
	});
	await page.mouse.move(0, 0);
	await page.screenshot({ path: `test-results/ui-${name}.png`, fullPage: true });
}
