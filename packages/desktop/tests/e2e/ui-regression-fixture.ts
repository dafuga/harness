import type { Page, TestInfo } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
import scenario from '../../../../specification/scenarios/runtime-evidence-ui.json' with { type: 'json' };
import { runtimeEvidence } from './runtime-evidence';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import { evidenceFixture, commits, ids, branch, sharedProject } from './ui-evidence-fixture';

/** Synthetic linked checkpoints over the shared recorded-history fixture. */
export async function regressionFixture(page: Page) {
	await evidenceFixture(page);
	await page.addInitScript(
		({ red, green, unit }) => {
			const bridge = (window as unknown as { harness: Required<Pick<DesktopBridge, 'evidence'>> })
				.harness;
			const read = bridge.evidence;
			bridge.evidence = async (input) => {
				const result = await read(input);
				const point = (commit: string, status: string, output: string) => ({
					commit,
					status,
					output,
					command: 'bun test orders',
					assertion: 'Expected 1 order; received 0',
					finishedAt: '2026-10-18T08:00:00Z'
				});
				Object.assign(result.evidence.after.detail!, {
					regressions: [
						{
							loop: 'selected-orders',
							units: [unit],
							red: {
								...point(red, 'failed', 'Expected 1 order; received 0'),
								assertion: 'Expected 1 order; received 0'
							},
							...(result.scope.commit === red
								? {}
								: { green: point(green, 'passed', '1 test passed') })
						}
					]
				});
				return result;
			};
		},
		{ red: commits.middle, green: commits.tip, unit: ids.filter }
	);
}

/** One standardized history flow, exercised at every declared viewport. */
export async function reviewRegression(page: Page, info: TestInfo): Promise<void> {
	await regressionFixture(page);
	const root = `/projects/${sharedProject}/harness/branch/${encodeURIComponent(branch)}`;
	const entity = `functions/${ids.filter}`;
	for (const viewport of scenario.viewports) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(`${root}/${entity}/history`);
		await expect(page.getByRole('heading', { name: 'Entity history' })).toBeVisible();
		await page.evaluate(
			() =>
				new Promise<void>((done) =>
					requestAnimationFrame(() => requestAnimationFrame(() => done()))
				)
		);
		const proof = page.getByRole('region', { name: 'Regression proof' });
		await runtimeEvidence(page, info, 'regression-proof');
		await expect(proof).toBeVisible({ timeout: 1500 });
		await expect(proof.getByText('Expected 1 order; received 0', { exact: true })).toBeVisible();
		await expect(proof.getByText('Same tests and command', { exact: true })).toBeVisible();
		await expect(proof.getByRole('link', { name: 'View failing test commit' })).toHaveAttribute(
			'href',
			`${root}/commit/${commits.middle}/${entity}`
		);
		await expect(proof.getByRole('link', { name: 'View fix commit' })).toHaveAttribute(
			'href',
			`${root}/commit/${commits.tip}/${entity}`
		);
		await proof.locator('summary').click();
		await expect(proof.locator('pre')).toHaveText([
			'Expected 1 order; received 0',
			'1 test passed'
		]);
		await runtimeEvidence(page, info, 'regression-proof-output');
		await proof.getByRole('link', { name: 'View failing test commit' }).click();
		const before = page.getByRole('region', { name: 'Regression proof' });
		await expect(before.getByText('Awaiting a passing fix commit.')).toBeVisible();
		await expect(before.getByRole('link', { name: 'View fix commit' })).toHaveCount(0);
		await runtimeEvidence(page, info, 'regression-proof-before');
	}
}
