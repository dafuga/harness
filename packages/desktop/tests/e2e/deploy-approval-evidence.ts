import { expect, type Page, type TestInfo } from '@playwright/test';
import { buildStamp } from '../../../../src/utils/buildStamp';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/reports-media/record-capture/recordCapture';
import scenario from '../../../../specification/scenarios/exact-release-deploy-approvals.json' with { type: 'json' };
import { captured } from './remote-evidence';
import { pageWorkload } from './page-workload';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';

export async function approvalEvidence(page: Page, info: TestInfo, state: string) {
	await captured(page, info, state);
	if (!evidenceRequested()) return;
	const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
	const buildId = buildStamp(
		(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
	);
	const size = page.viewportSize();
	const viewport = scenario.viewports.find(
		({ width, height }) => size?.width === width && size.height === height
	)?.id;
	expect(buildId, 'Exact compiled build stamp').toBeTruthy();
	expect(revision, 'Exact source revision').toMatch(/^[a-f0-9]{40}$/);
	expect(viewport, 'Declared viewport').toBeTruthy();
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	recordCapture(
		{
			evidence: 'approval-screens',
			kind: 'screenshot',
			state,
			viewport: viewport!,
			file: `approval-${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server: { revision, buildId: buildId! },
			note: 'Compiled Harness renderer with a synthetic Electron or Capacitor account adapter and review fixture.'
		},
		await page.screenshot({ animations: 'disabled', caret: 'hide' })
	);
	if (state === 'pending') {
		await pageWorkload(page, scenario as ScenarioManifest, {
			state,
			viewport: viewport!,
			name: 'approvals',
			buildId: buildId!
		});
	}
}
