import { expect, test, type Page } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
import { agentActivityFixture } from './ui-agent-activity-fixture';
import { projectFixture, alpha } from './ui-project-fixture';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenario from '../../../../specification/scenarios/agent-creation.json' with { type: 'json' };
import { scenarioCapture } from './scenario-capture';

for (const width of [1440, 390]) {
	for (const category of ['functions', 'components']) {
		test(`agent footer leaves room for writing at ${width}px in ${category}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await projectFixture(page);
			await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/${category}`);
			await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
			const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
			const message = panel.getByRole('textbox', { name: 'Message', exact: true });
			await message.fill('Add a shared elapsed-time formatter.');
			await expect(panel.getByRole('button', { name: 'Choose model', exact: true })).toBeVisible();
			await expect(
				panel.getByRole('button', { name: 'Reasoning effort', exact: true })
			).toBeVisible();
			await expect(panel.getByLabel('Design options')).toHaveCount(0);
			await page.evaluate(async () => {
				await document.fonts.ready;
				await Promise.all([...document.images].map((image) => image.decode()));
			});
			await page.mouse.move(0, 0);
			if (process.env.TAKE_SCREENSHOT === 'true') {
				mkdirSync('/tmp/compact-agent-evidence', { recursive: true });
				await page.screenshot({
					path: `/tmp/compact-agent-evidence/${process.env.SCREENSHOT_LABEL}-${width}-${category}.png`
				});
			}
			const writing = await message.boundingBox();
			const composer = await panel.locator('form').boundingBox();
			expect(composer!.y + composer!.height - writing!.y - writing!.height).toBeLessThanOrEqual(
				115
			);
			const bounds = await panel.boundingBox();
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
			await expect(panel.getByRole('button', { name: 'Send plan', exact: true })).toBeEnabled();
			await expect(panel.getByRole('button', { name: 'Change', exact: true })).toBeEnabled();
			await scenarioCapture(page, scenario as ScenarioManifest, {
				state: `compact-agent-${category}`,
				name: `${width}`,
				note: 'Actual compiled renderer over a SYNTHETIC project with fixture providers; no live agent run.'
			});
		});
	}
}

async function compactProviders(page: Page) {
	await projectFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as { harness: Record<string, unknown>; __calls: unknown[] };
		host.harness.providers = async () =>
			['codex', 'claude'].map((id) => ({
				id,
				label: id === 'codex' ? 'Codex CLI' : 'Claude CLI',
				available: true,
				reason: null,
				models: ['first', 'second'].map((model) => ({
					id: `${id}-${model}`,
					label: `${id} ${model}`,
					efforts: ['medium', 'high'],
					defaultEffort: 'medium',
					isDefault: model === 'first'
				}))
			}));
		host.harness.startRun = async (input: unknown) => {
			host.__calls.push({ op: 'startRun', ...(input as object) });
			return { runId: 'compact-run' };
		};
	});
}

test('compact controls send the selected provider, model, effort and design count', async ({
	page
}) => {
	await compactProviders(page);
	const project = `/projects/${alpha}/harness/branch/feat%2Falpha/components`;
	await page.goto(`/settings?from=${encodeURIComponent(project)}`);
	await page.getByLabel('Design options', { exact: true }).selectOption('2');
	await page.getByRole('link', { name: 'Back to project', exact: true }).click();
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await panel.getByRole('button', { name: 'Choose model', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Choose model', exact: true })
		.getByRole('button', { name: 'claude second', exact: true })
		.click();
	await panel.getByRole('button', { name: 'Reasoning effort', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Reasoning effort', exact: true })
		.getByRole('button', { name: 'high', exact: true })
		.click();
	await panel
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Add an elapsed time badge.');
	await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() =>
				(window as unknown as { __calls: Record<string, unknown>[] }).__calls.find(
					(call) => call.op === 'startRun'
				)
			)
		)
		.toMatchObject({
			provider: 'claude',
			model: 'claude-second',
			effort: 'high',
			designOptions: 2
		});
});

// The standard project-chat matrix also proves the adjacent activity view and retained draft.
for (const width of [1440, 920, 390]) {
	test(`project chat shows sessions and module owners at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await agentActivityFixture(page);
		await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/components`);
		await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
		const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
		await panel.getByRole('textbox', { name: 'Message', exact: true }).fill('Keep my draft.');
		await evidence(page, width);
		await panel.getByRole('button', { name: /^Agents/ }).click();
		await expect(panel.getByRole('heading', { name: 'Main chats', exact: true })).toBeVisible();
		await expect(
			panel.getByText('Refine shared component previews', { exact: true })
		).toBeVisible();
		await expect(
			panel.getByText('Review card usage on the home page', { exact: true })
		).toBeVisible();
		await expect(panel.getByText('Stale', { exact: true })).toBeVisible();
		const modules = panel.getByRole('region', { name: 'Modules being worked on', exact: true });
		await expect(modules.getByText('2 agents', { exact: true })).toBeVisible();
		await expect(modules.getByRole('link', { name: 'Card', exact: true })).toBeVisible();
		await expect(modules.getByText('Old assignment', { exact: true })).toHaveCount(0);
		await evidence(page, width, 'agents');
		await scenarioCapture(page, scenario as ScenarioManifest, {
			state: 'chat-agents',
			name: String(width),
			note: 'Compiled renderer with synthetic declared sessions; no live model requests.'
		});
		await modules.getByRole('link', { name: 'Card', exact: true }).click();
		await expect(page).toHaveURL(/components\/component.card/);
		await panel.getByRole('button', { name: 'Chat', exact: true }).click();
		await expect(panel.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
			'Keep my draft.'
		);
	});
}

async function evidence(page: Page, width: number, state = 'chat') {
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	mkdirSync('/tmp/chat-agents-evidence', { recursive: true });
	await page.screenshot({
		path: `/tmp/chat-agents-evidence/${process.env.SCREENSHOT_LABEL}-${width}-${state}.png`
	});
}

test('agent refresh failures retain the last reading and unsupported hosts stay unknown', async ({
	page
}) => {
	await agentActivityFixture(page);
	await page.goto(`/projects/${alpha}/harness/branch/feat%2Falpha/components`);
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await panel.getByRole('button', { name: /^Agents/ }).click();
	await expect(panel.getByText('Refine shared component previews', { exact: true })).toBeVisible();
	await page.evaluate(() => {
		(window as unknown as { __activityFailed: boolean }).__activityFailed = true;
	});
	await panel.getByRole('button', { name: 'Refresh agents', exact: true }).click();
	await expect(
		panel.getByText('Could not refresh. Showing the last reading.', { exact: true })
	).toBeVisible();
	await expect(panel.getByText('Refine shared component previews', { exact: true })).toBeVisible();
	await evidence(page, 1440, 'refresh-failed');
	await page.getByRole('button', { name: 'Close chat', exact: true }).click();
	await page.evaluate(() => {
		delete (window as unknown as { harness: { agentActivity?: unknown } }).harness.agentActivity;
	});
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	await expect(
		panel.getByText('Live agent activity is unavailable for this project.', { exact: true })
	).toBeVisible();
	await expect(panel.getByText('0 working', { exact: true })).toHaveCount(0);
	await evidence(page, 1440, 'unavailable');
});
