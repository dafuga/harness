import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { projectFixture, alpha } from './ui-project-fixture';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenario from '../../../../specification/scenarios/agent-settings.json' with { type: 'json' };
import { scenarioCapture } from './scenario-capture';

export const agentAt = `/projects/${alpha}/harness/branch/feat%2Falpha/components`;
export const settingsAt = `/settings?from=${encodeURIComponent(agentAt)}`;

/** Both CLI discoveries use synthetic models; no CLI or image generator runs. */
export async function agentSettingsFixture(page: Page) {
	await projectFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as { harness: Record<string, unknown>; __calls: unknown[] };
		host.harness.providers = async () =>
			['codex', 'claude'].map((id) => ({
				id,
				label: id === 'codex' ? 'Codex CLI' : 'Claude CLI',
				available: true,
				reason: null,
				models: ['standard', 'extended'].map((model) => ({
					id: `${id}-${model}`,
					label: `${id === 'codex' ? 'Codex' : 'Claude'} ${model}`,
					efforts: id === 'codex' ? ['low', 'medium', 'high'] : ['medium', 'high', 'max'],
					defaultEffort: 'medium',
					isDefault: model === 'standard'
				}))
			}));
		host.harness.startRun = async (input: unknown) => {
			host.__calls.push({ op: 'startRun', ...(input as object) });
			return { runId: 'settings-run' };
		};
	});
}

export async function openAgent(page: Page) {
	await page.goto(agentAt);
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	return page.getByRole('complementary', { name: 'Project agent', exact: true });
}

export async function rememberSettings(page: Page, name: string) {
	if (name === 'settings')
		await page.getByRole('heading', { name: 'Settings', exact: true, level: 1 }).waitFor();
	if (name === 'models')
		await page.getByRole('dialog', { name: 'Choose model', exact: true }).waitFor();
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	const state = { compact: 'compact-controls', models: 'model-picker', settings: 'settings' }[name];
	if (!state) throw new Error(`Unknown agent settings checkpoint: ${name}`);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state,
		name,
		note: 'Actual compiled renderer over synthetic CLI discoveries; no live agent or image generator runs.'
	});
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	mkdirSync('/tmp/agent-settings-evidence', { recursive: true });
	await page.screenshot({
		path: `/tmp/agent-settings-evidence/${process.env.SCREENSHOT_LABEL}-${name}-${page.viewportSize()?.width}.png`
	});
}

export async function expectRun(page: Page, fields: Record<string, unknown>) {
	await expect
		.poll(() =>
			page.evaluate(() =>
				(window as unknown as { __calls: Record<string, unknown>[] }).__calls.find(
					(call) => call.op === 'startRun'
				)
			)
		)
		.toMatchObject(fields);
}
