import { expect, test } from '../../../../test/support/browserTest';
import {
	agentSettingsFixture,
	expectRun,
	openAgent,
	rememberSettings,
	settingsAt
} from './agent-settings-fixture';

test('unavailable Codex stays disabled and an available Claude model can run', async ({ page }) => {
	await agentSettingsFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as {
			harness: {
				providers: () => Promise<Array<{ id: string; available: boolean; reason: string | null }>>;
			};
		};
		const discover = host.harness.providers;
		host.harness.providers = async () =>
			(await discover()).map((p) =>
				p.id === 'codex' ? { ...p, available: false, reason: 'Sign in to Codex CLI.' } : p
			);
	});
	const panel = await openAgent(page);
	await panel.getByRole('button', { name: 'Choose model', exact: true }).click();
	const models = page.getByRole('dialog', { name: 'Choose model', exact: true });
	await expect(models.getByText('Sign in to Codex CLI.', { exact: true })).toBeVisible();
	await expect(models.getByRole('button', { name: 'Codex standard', exact: true })).toBeDisabled();
	await expect(
		models.getByRole('button', { name: 'Claude standard', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await models.getByRole('button', { name: 'Claude extended', exact: true }).click();
	await panel.getByRole('textbox', { name: 'Message', exact: true }).fill('Use the available CLI.');
	await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expectRun(page, { provider: 'claude', model: 'claude-extended', effort: 'medium' });
});

test('a model without effort choices uses its default and disables the intelligence icon', async ({
	page
}) => {
	await agentSettingsFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as {
			harness: { providers: () => Promise<Array<{ models: Array<Record<string, unknown>> }>> };
		};
		const discover = host.harness.providers;
		host.harness.providers = async () =>
			(await discover()).map((p) => ({
				...p,
				models: p.models.map((m) => ({ ...m, efforts: [], defaultEffort: null }))
			}));
	});
	const panel = await openAgent(page);
	await expect(panel.getByRole('button', { name: 'Reasoning effort', exact: true })).toBeDisabled();
	await panel.getByRole('textbox', { name: 'Message', exact: true }).fill('Use model defaults.');
	await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expectRun(page, { effort: null });
});

test('a failed preference save is visible while the chosen value stays usable in the page', async ({
	page
}) => {
	await agentSettingsFixture(page);
	await page.addInitScript(() => {
		Storage.prototype.setItem = () => {
			throw new Error('Fixture storage denied');
		};
	});
	await page.goto(settingsAt);
	const count = page.getByRole('combobox', { name: 'Design options', exact: true });
	await count.selectOption('2');
	await expect(count).toHaveValue('2');
	await expect(page.getByRole('alert')).toContainText(/save/i);
});

test('Settings refuses an external return target', async ({ page }) => {
	await agentSettingsFixture(page);
	await page.goto('/settings?from=%2F%2Fexample.invalid');
	await expect(page.getByRole('link', { name: /Back/ })).toHaveAttribute('href', '/');
});

test('the combined model picker fits a phone and keeps both provider groups reachable', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 900 });
	await agentSettingsFixture(page);
	const panel = await openAgent(page);
	await panel.getByRole('button', { name: 'Choose model', exact: true }).click();
	const models = page.getByRole('dialog', { name: 'Choose model', exact: true });
	await rememberSettings(page, 'models');
	await expect(models.getByRole('heading', { name: 'Codex CLI', exact: true })).toBeVisible();
	await expect(models.getByRole('heading', { name: 'Claude CLI', exact: true })).toBeVisible();
	const box = (await models.boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.x + box.width).toBeLessThanOrEqual(390);
	expect(box.y + box.height).toBeLessThanOrEqual(900);
});
