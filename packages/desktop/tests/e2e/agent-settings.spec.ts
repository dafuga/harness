import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../../../../test/support/browserTest';
import {
	agentAt,
	agentSettingsFixture,
	expectRun,
	openAgent,
	rememberSettings,
	settingsAt
} from './agent-settings-fixture';

for (const width of [1440, 920, 390]) {
	test(`Settings owns the persistent design count at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: width === 920 ? 800 : 900 });
		await agentSettingsFixture(page);
		await page.goto(settingsAt);
		await rememberSettings(page, 'settings');
		if (process.env.HARNESS_EVIDENCE_DIR) {
			const viewport = width === 1440 ? 'desktop' : width === 920 ? 'tablet' : 'phone';
			const saved = JSON.parse(
				readFileSync(
					join(process.env.HARNESS_EVIDENCE_DIR, `settings-settings-${viewport}-benchmark.json`),
					'utf8'
				)
			);
			for (const metric of ['browser-navigation-ms', 'browser-js-heap-bytes']) {
				const observed = saved.measurements.find(
					(m: { unit: string; metric: string }) =>
						m.unit === 'desktop.page.settings' && m.metric === metric
				);
				expect(observed, `Settings records ${metric} at ${viewport}`).toBeDefined();
				expect(observed.value).toBeGreaterThan(0);
			}
		}
		await expect(
			page.getByRole('heading', { name: 'Settings', exact: true, level: 1 })
		).toBeVisible();
		const count = page.getByRole('combobox', {
			name: 'Design options',
			exact: true
		});
		await expect(count).toHaveValue('3');
		await expect(count.locator('option')).toHaveCount(10);
		await count.selectOption('2');
		await page.reload();
		await expect(count).toHaveValue('2');
		await page.getByRole('link', { name: 'Back to project', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`${agentAt}$`));
		await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
		const panel = page.getByRole('complementary', {
			name: 'Project agent',
			exact: true
		});
		await expect(panel.getByRole('combobox', { name: 'Design options', exact: true })).toHaveCount(
			0
		);
		await panel.getByRole('textbox', { name: 'Message', exact: true }).fill('Use my saved count.');
		await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
		await expectRun(page, { mode: 'plan', designOptions: 2 });
	});
}

test('the workspace links to Settings and a headless Plan omits the design count', async ({
	page
}) => {
	await agentSettingsFixture(page);
	await openAgent(page);
	await page.getByRole('link', { name: 'Settings', exact: true }).click();
	await expect(
		page.getByRole('heading', { name: 'Settings', exact: true, level: 1 })
	).toBeVisible();
	await page.getByRole('combobox', { name: 'Design options', exact: true }).selectOption('10');
	await page.goto(agentAt.replace(/components$/, 'functions'));
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Add a formatter.');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expectRun(page, { mode: 'plan' });
	const run = await page.evaluate(() =>
		(window as unknown as { __calls: Record<string, unknown>[] }).__calls.find(
			(c) => c.op === 'startRun'
		)
	);
	expect(run).not.toHaveProperty('designOptions');
});
