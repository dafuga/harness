import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import { longAgentActivityFixture, readyForAgentCapture } from './ui-agent-activity-fixture';
import { scenarioCapture } from './scenario-capture';
import { expect, test } from '../../../../test/support/browserTest';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { projectFixture, alpha, gamma, earlier } from './ui-project-fixture';
import { creationFixture } from './ui-agent-creation-fixture';
import {
	evidenceRequested,
	recordCapture
} from '../../../../src/utils/record-capture/recordCapture';
import { buildStamp } from '../../../../src/utils/buildStamp';
import scenario from '../../../../specification/scenarios/agent-creation.json' with { type: 'json' };

const route = (category: string, project = alpha, commit = '') =>
	`/projects/${project}/harness/branch/${project === gamma ? 'feat%2Fgamma' : 'feat%2Falpha'}${commit ? '/commit/' + commit : ''}/${category}`;

async function remember(page: Page, info: TestInfo, state: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await page.mouse.move(0, 0);
	if (evidenceRequested()) {
		const recorded = stateId(state);
		const size = page.viewportSize();
		const viewport = scenario.viewports.find(
			(item) => item.width === size?.width && item.height === size?.height
		);
		const buildId = buildStamp(
			(await page.locator('meta[name="harness-build"]').getAttribute('content')) ?? undefined
		);
		const revision = process.env.HARNESS_VERIFY_REVISION ?? '';
		if (!viewport || !buildId || !/^[a-f0-9]{40}$/.test(revision))
			throw new Error('Compiled scenario identity is missing');
		recordCapture(
			{
				evidence: 'creation-' + recorded,
				kind: 'screenshot',
				state: recorded,
				viewport: viewport.id,
				file: `creation-${recorded}-${info.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 80)}-${viewport.id}.png`,
				mediaType: 'image/png',
				provenance: 'actual-capture',
				server: { buildId, revision },
				note: 'Actual shared workspace over SYNTHETIC projects, injected provider discovery and request boundary. No live agent execution claimed.'
			},
			await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })
		);
	}
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	const folder = process.env.AGENT_CREATION_SHOTS ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	await page.screenshot({
		path: join(folder, `${process.env.SCREENSHOT_LABEL ?? 'run'}-${state}.png`),
		fullPage: true
	});
}

function stateId(state: string) {
	if (state.endsWith('-catalog')) return 'catalog';
	return state === 'creation-request' ? 'request' : 'conversation';
}

for (const category of ['components', 'functions']) {
	test(`${category} are added through the bottom-right agent rather than a creation form`, async ({
		page
	}, info) => {
		await projectFixture(page);
		await page.goto(route(category));
		await expect(
			page.getByRole('heading', {
				name: new RegExp('^' + (category === 'functions' ? 'helpers' : category) + '$', 'i'),
				level: 1
			})
		).toBeVisible();
		await remember(page, info, category + '-catalog');
		await expect(
			page.getByRole('button', { name: /^\+?\s*New (component|function)$/ })
		).toHaveCount(0);
		const launcher = page.getByRole('button', { name: 'Work with agent', exact: true });
		await expect(launcher).toBeVisible();
		const box = await launcher.boundingBox();
		expect(box!.x + box!.width).toBeGreaterThan(page.viewportSize()!.width * 0.8);
		expect(box!.y + box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.8);
		await launcher.click();
		const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
		await expect(panel.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
		await expect(page.getByRole('textbox', { name: 'Goal', exact: true })).toHaveCount(0);
		await expect(panel.getByRole('button', { name: 'Choose model', exact: true })).toBeVisible();
	});
}

test('conversation sends the creation prompt with the selected model and project', async ({
	page
}, info) => {
	await projectFixture(page);
	await page.goto(route('functions'));
	await page.evaluate(() => {
		const host = window as unknown as { harness: Record<string, unknown>; __calls: unknown[] };
		host.harness.startRun = async (input: unknown) => {
			host.__calls.push({ op: 'startRun', ...(input as object) });
			return { runId: 'conversation-run' };
		};
	});
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await panel
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Add a shared function that formats elapsed milliseconds for people.');
	await remember(page, info, 'creation-request');
	await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
	const calls = () =>
		page.evaluate(() => (window as unknown as { __calls: Record<string, unknown>[] }).__calls);
	await expect.poll(async () => (await calls()).filter((c) => c.op === 'startRun').length).toBe(1);
	expect((await calls()).find((c) => c.op === 'startRun')).toMatchObject({
		intent: 'create',
		category: 'functions',
		mode: 'plan',
		projectId: alpha,
		provider: 'codex',
		model: 'fixture',
		text: 'Add a shared function that formats elapsed milliseconds for people.'
	});
	expect((await calls()).filter((c) => c.op === 'createPlan')).toEqual([]);
});

test('hosted and pinned revisions offer no project AI creation', async ({ page }) => {
	await projectFixture(page);
	for (const target of [route('components', gamma), route('functions', alpha, earlier)]) {
		await page.goto(target);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await page.getByRole('button', { name: /^(Work with agent|Open project chat)$/ }).click();
		const chat = page.getByRole('complementary', { name: 'Project agent', exact: true });
		for (const mode of ['Plan', 'Ask', 'Change'])
			await expect(chat.getByRole('button', { name: mode, exact: true })).toHaveCount(0);
		await expect(chat.getByRole('button', { name: /^Send (plan|ask|change)$/ })).toHaveCount(0);
		await expect(
			page.getByRole('button', { name: /^\+?\s*New (component|function)$/ })
		).toHaveCount(0);
	}
});

test('a created entity opens its original request thread', async ({ page }) => {
	await creationFixture(page);
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
	const text = 'Add a function to format elapsed milliseconds for people';
	await panel.getByRole('textbox', { name: 'Message', exact: true }).fill(text);
	await panel.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expect(page).toHaveURL(/\/functions\/function.format-time$/);
	await expect(
		page.getByRole('heading', { name: 'Format elapsed time · Thread #1', exact: true })
	).toBeVisible();
	await expect(page.getByText(text, { exact: true })).toBeVisible();
});

for (const viewport of [
	{ width: 768, height: 1024 },
	{ width: 390, height: 844 }
]) {
	test(`agent conversation stays within ${viewport.width}px viewport`, async ({ page }, info) => {
		await page.setViewportSize(viewport);
		await projectFixture(page);
		await page.goto(route('components'));
		await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
		const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
		await expect(panel.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
		await remember(page, info, 'conversation-' + viewport.width);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			viewport.width
		);
		const box = await panel.boundingBox();
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
	});
}

test('a long agent roster keeps current module assignments in view', async ({ page }) => {
	await longAgentActivityFixture(page);
	await page.goto(route('components'));
	await page.getByRole('button', { name: 'Work with agent', exact: true }).click();
	const panel = page.getByRole('complementary', { name: 'Project agent', exact: true });
	await panel.getByRole('button', { name: 'Agents', exact: true }).click();
	await expect(panel.getByText('Refine shared component previews', { exact: true })).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await readyForAgentCapture(page);
		mkdirSync('/tmp/chat-agents-evidence', { recursive: true });
		await page.screenshot({
			path: `/tmp/chat-agents-evidence/${process.env.SCREENSHOT_LABEL}-long-roster.png`
		});
	}
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'chat-agents-many',
		name: 'long-roster',
		note: 'Synthetic fifteen-session roster over the compiled renderer; module visibility is asserted at this checkpoint.'
	});
	await expect(
		panel
			.getByRole('region', { name: 'Modules being worked on' })
			.getByRole('link', { name: 'Card', exact: true })
	).toBeInViewport();
	await panel.getByRole('button', { name: 'Show all 15 sessions', exact: true }).click();
	await expect(panel.getByText('Earlier session 11', { exact: true })).toBeVisible();
});
