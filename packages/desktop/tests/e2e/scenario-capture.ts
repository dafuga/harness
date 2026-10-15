import type { Page } from '@playwright/test';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import { buildStamp } from '../../../../src/utils/buildStamp';
import { evidenceRequested, recordCapture } from '../../../../src/utils/recordCapture';

/**
 * In a verification, the page as it is now is the capture of `state`: the stamped build, at the
 * viewport the scenario declares for its exact size, once fonts, images and the pointer settle.
 * Elsewhere nothing. A state, size or identity the scenario does not declare fails the test.
 */
export async function scenarioCapture(
	page: Page,
	scenario: ScenarioManifest,
	capture: { state: string; name: string; note: string }
): Promise<void> {
	if (!evidenceRequested()) return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		(item) => item.width === size?.width && item.height === size?.height
	)?.id;
	const evidence = scenario.evidence.find(
		(item) =>
			item.kind === 'screenshot' &&
			item.states.includes(capture.state) &&
			item.viewports.includes(viewport ?? '')
	);
	if (!viewport || !evidence)
		throw new Error(`${scenario.id} declares no ${capture.state} capture at this viewport`);
	const stamp = await page.locator('meta[name="harness-build"]').getAttribute('content');
	const buildId = buildStamp(stamp ?? undefined);
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	if (!buildId) throw new Error('The rendered build has no compiled identity stamp');
	if (process.env.HARNESS_VERIFY !== '1' || !/^[a-f0-9]{40}$/.test(revision))
		throw new Error('A verification revision is required to record a capture');
	recordCapture(
		{
			evidence: evidence.id,
			kind: 'screenshot',
			state: capture.state,
			viewport,
			file: `${capture.state}-${capture.name}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { buildId, revision },
			note: capture.note
		},
		await page.screenshot({ animations: 'disabled', caret: 'hide' })
	);
}
