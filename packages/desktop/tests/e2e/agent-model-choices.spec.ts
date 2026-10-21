import { expect, test } from '../../../../test/support/browserTest';
import {
	agentSettingsFixture,
	expectRun,
	openAgent,
	rememberSettings
} from './agent-settings-fixture';

for (const width of [1440, 390]) {
	test(`compact agent uses model and intelligence icons at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await agentSettingsFixture(page);
		const panel = await openAgent(page);
		await panel.getByRole('textbox', { name: 'Message', exact: true }).fill('Add a timer badge.');
		await rememberSettings(page, 'compact');
		const model = panel.getByRole('button', { name: 'Choose model', exact: true });
		const effort = panel.getByRole('button', { name: 'Reasoning effort', exact: true });
		await expect(model).toBeVisible();
		await expect(effort).toBeVisible();
		await expect(model.locator('svg')).toHaveCount(1);
		await expect(effort.locator('svg')).toHaveCount(1);
		await expect(panel.getByRole('combobox')).toHaveCount(0);
		const change = panel.getByRole('button', { name: 'Change', exact: true });
		await expect(change).toBeEnabled();
		await change.click();
		await expect(change).toHaveAttribute('aria-pressed', 'true');
		await expect(panel.getByRole('button', { name: 'Send change', exact: true })).toBeEnabled();
		expect(
			await page.evaluate(() =>
				(window as unknown as { __calls: { op: string }[] }).__calls.filter(
					(call) => call.op === 'startRun'
				)
			)
		).toEqual([]);
		await panel.getByRole('button', { name: 'Plan', exact: true }).click();
		await expect(panel.getByRole('button', { name: 'Send plan', exact: true })).toBeEnabled();
	});
}

test('one model picker shows both CLIs and sends the selected model and supported intelligence', async ({
	page
}) => {
	await agentSettingsFixture(page);
	const panel = await openAgent(page);
	const trigger = panel.getByRole('button', { name: 'Choose model', exact: true });
	await trigger.click();
	const models = page.getByRole('dialog', { name: 'Choose model', exact: true });
	await rememberSettings(page, 'models');
	await expect(models.getByRole('heading', { name: 'Codex CLI', exact: true })).toBeVisible();
	await expect(models.getByRole('heading', { name: 'Claude CLI', exact: true })).toBeVisible();
	await expect(models.getByRole('button', { name: 'Codex extended', exact: true })).toBeVisible();
	await models.getByRole('button', { name: 'Claude extended', exact: true }).click();
	await expect(models).not.toBeVisible();
	await panel.getByRole('button', { name: 'Reasoning effort', exact: true }).click();
	const intelligence = page.getByRole('dialog', { name: 'Reasoning effort', exact: true });
	await expect(intelligence.getByRole('button', { name: 'low', exact: true })).toHaveCount(0);
	await intelligence.getByRole('button', { name: 'max', exact: true }).click();
	await panel.getByRole('textbox', { name: 'Message', exact: true }).fill('Add a timer badge.');
	await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expectRun(page, {
		provider: 'claude',
		model: 'claude-extended',
		effort: 'max',
		designOptions: 3
	});
});

test('Escape closes the model picker and returns focus without closing the agent panel', async ({
	page
}) => {
	await agentSettingsFixture(page);
	const panel = await openAgent(page);
	const trigger = panel.getByRole('button', { name: 'Choose model', exact: true });
	await trigger.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Choose model', exact: true })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Choose model', exact: true })).not.toBeVisible();
	await expect(panel).toBeVisible();
	await expect(trigger).toBeFocused();
});
