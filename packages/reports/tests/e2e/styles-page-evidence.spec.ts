import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../../../../test/support/browserTest';
import { benchmarkCaptureSchema } from '../../../../src/core/verification-evidence/verifyTypes';
import { expectNoOverflow, tip } from './support/explorer';
import { appStyleTokensConfig } from '../../src/configs/shared-primitives/appStyleTokensConfig';
import { declaredStyleTokens, expectColorRoles } from './support/styleCatalog';
import { captureScreen, evidenceDirectory, viewports } from './support/harnessCapture';

const pageUnit = 'reports.page.harness-branch-branch-at-styles';
const screenUnit = 'reports.component.explorer-ui-harness-explorer-styles-screen';
const styleUnit = 'reports.style.explorer-styles';

function expectCapturedMeasurements(state: string, viewport: string): void {
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	if (!directory || !process.env.HARNESS_VERIFY_REVISION) return;
	const lines = readFileSync(join(directory, 'captures.ndjson'), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line) as Record<string, unknown>);
	const screenshot = lines.find(
		(line) => line.kind === 'screenshot' && line.state === state && line.viewport === viewport
	);
	expect(screenshot?.server).toMatchObject({ revision: process.env.HARNESS_VERIFY_REVISION });
	expect(screenshot?.evidence).toBe(`${state}-screen`);
	const benchmark = benchmarkCaptureSchema.parse(
		JSON.parse(readFileSync(join(directory, `${state}-${viewport}-benchmark.json`), 'utf8'))
	);
	for (const unit of [
		pageUnit,
		screenUnit,
		styleUnit,
		'reports.style.app-tokens',
		'function.explorer-route',
		'reports.component.harness-harness-console',
		'reports.function.harness-icons',
		'reports.function.harness-shell',
		'reports.style.explorer',
		'reports.style.explorer-navbar'
	]) {
		for (const metric of ['browser-navigation-ms', 'browser-js-heap-bytes']) {
			const observation = benchmark.measurements.find(
				(item) => item.unit === unit && item.metric === metric
			);
			expect(observation, `${unit} records ${metric} at ${viewport}`).toBeDefined();
			expect(observation!.value).toBeGreaterThan(0);
			expect(observation!.target).toBe('http');
			expect(observation!.samples).toBeGreaterThan(0);
		}
	}
}

for (const viewport of viewports) {
	test(`Styles records its rendered token catalog at ${viewport.id} width`, async ({ page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(tip('main', 'styles'));
		for (const heading of ['Styles', ...appStyleTokensConfig.groups])
			await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
		await expect(page.locator('[data-style-token]')).toHaveCount(declaredStyleTokens().length);
		for (const name of declaredStyleTokens())
			await expect(page.locator(`[data-style-token="${name}"]`)).toHaveCount(1);
		await expectNoOverflow(page);
		const state = `catalog-${viewport.id}`;
		await captureScreen(page, state, viewport, {
			directory: evidenceDirectory,
			evidence: `${state}-screen`
		});
		await expectColorRoles(page.locator('main'));
		expectCapturedMeasurements(state, viewport.id);
	});
}
