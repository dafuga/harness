import { expect, test, type Page } from '../../../../test/support/browserTest';
import { mkdirSync } from 'node:fs';
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
			await expect(panel.getByRole('button', { name: 'Change', exact: true })).toBeDisabled();
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
