import type { Page } from '../../../../../test/support/browserTest';
import { expect } from '../../../../../test/support/browserTest';
import { resolve } from 'node:path';
import scenario from '../../../../../specification/scenarios/mac-tracker-inbox.json' with { type: 'json' };
import { buildStamp } from '../../../../../src/utils/development-tooling/buildStamp';
import { recordCapture } from '../../../../../src/utils/reports-media/record-capture/recordCapture';
import { scenarioManifestSchema } from '../../../../../src/core/development-tooling/unitTypes';
import { pageWorkload } from '../page-workload';

export async function captureMacInbox(page: Page, state: string) {
	const folder = process.env.HARNESS_EVIDENCE_DIR;
	const saveScreenshot = process.env.TAKE_SCREENSHOT === 'true';
	if (!folder && !saveScreenshot) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	if (state.startsWith('confirm-'))
		await page.getByRole('group', { name: 'Confirm this write' }).scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		({ width, height }) => width === size?.width && height === size?.height
	)?.id;
	if (!viewport) throw new Error('Mac inbox screenshot has no declared viewport');
	const file = `mac-inbox-${state}-${viewport}.png`;
	const path = saveScreenshot
		? resolve('test-results', `${process.env.SCREENSHOT_LABEL}-${file}`)
		: undefined;
	const bytes = await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
	if (!folder) return;
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION;
	expect(buildId).toBeTruthy();
	expect(revision).toMatch(/^[a-f0-9]{40}$/);
	const environment = { HARNESS_EVIDENCE_DIR: folder, TAKE_SCREENSHOT: '1' };
	recordCapture(
		{
			evidence: 'mac-inbox-screens',
			kind: 'screenshot',
			state,
			viewport,
			file,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId: buildId!, revision: revision! },
			note: 'Compiled Electron renderer and local transport over a disposable SQLite Tracker fixture.'
		},
		bytes,
		environment
	);
	if (state === 'list')
		await pageWorkload(page, scenarioManifestSchema.parse(scenario), {
			state,
			viewport,
			name: 'mac-inbox',
			buildId: buildId!,
			target: 'process'
		});
}
