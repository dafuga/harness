import type { Page } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
import { exampleDocument } from '../../../game/src/index';
import { viewSettings } from './game-unsaved-fixture';

export const levelProject = '/game?projectId=local-' + 'd'.repeat(64) + '&level-fixture=1';
const layout = {
	width: 12,
	depth: 8,
	spawn: { x: 1, z: 1 },
	objects: [
		{
			id: 'stone-wall',
			kind: 'wall',
			label: 'Stone wall',
			x: 5,
			z: 4,
			width: 1,
			depth: 3,
			height: 2
		},
		{ id: 'lantern', kind: 'goal', label: 'Lantern', x: 10, z: 6, width: 1, depth: 1, height: 1 }
	]
};
const providers = [
	{
		id: 'codex',
		label: 'Codex CLI',
		available: true,
		reason: null,
		version: 'fixture',
		imageGeneration: false,
		models: [
			{ id: 'test-model', label: 'Test model', efforts: [], defaultEffort: null, isDefault: true }
		]
	}
];
/** A saved project and deterministic model response; no real provider or file writes. */
export async function installLevelProject(page: Page) {
	await installDocument(page);
	await installGeneration(page);
}
async function installDocument(page: Page) {
	await page.addInitScript(
		({ initial, providers }) => {
			if (!location.search.includes('level-fixture=1')) return;
			let revision = 'a'.repeat(64);
			const bridge = Reflect.get(window, 'harness') ?? {};
			Object.assign(bridge, {
				providers: async () => providers,
				gameRead: async () => ({
					document: JSON.parse(localStorage.getItem('level-document') ?? JSON.stringify(initial)),
					revision
				}),
				gameSave: async (input: { document: unknown; expectedRevision: string }) => {
					if (input.expectedRevision !== revision) throw Error('The game changed.');
					localStorage.setItem('level-document', JSON.stringify(input.document));
					revision = revision === 'a'.repeat(64) ? 'b'.repeat(64) : 'a'.repeat(64);
					return { revision };
				}
			});
			Object.assign(window, { harness: bridge });
		},
		{ initial: exampleDocument(), providers }
	);
}
async function installGeneration(page: Page) {
	await page.addInitScript(
		({ layout }) => {
			if (!location.search.includes('level-fixture=1')) return;
			const bridge = Reflect.get(window, 'harness') ?? {};
			Object.assign(bridge, {
				gameLevelGenerate: async (input: {
					document: ReturnType<typeof exampleDocument>;
					viewId: string;
					feedback?: string;
				}) => {
					const view = input.document.views.find((v) => v.id === input.viewId)!;
					const planning = Reflect.get(view, 'planning') as {
						concept: string;
						description: string;
					};
					const calls = Number(localStorage.getItem('level-calls') ?? 0) + 1;
					localStorage.setItem('level-calls', String(calls));
					return {
						proposal: {
							id: calls.toString(16).padStart(64, '0'),
							concept: planning.concept,
							description: planning.description,
							dimension: view.dimension,
							provider: 'codex',
							model: 'test-model',
							summary: 'Cross the island and reach the lantern.',
							layout
						}
					};
				}
			});
			Object.assign(window, { harness: bridge });
		},
		{ layout }
	);
}

export async function buildLevel(
	page: Page,
	dimension = '2d',
	capture?: (page: Page, name: string) => Promise<void>
) {
	await page.getByLabel('Concept', { exact: true }).fill('A lantern island');
	await page.getByRole('button', { name: 'Continue to level brief', exact: true }).click();
	await page
		.getByLabel('Level brief', { exact: true })
		.fill('An island with a stone wall and a lantern at its far shore.');
	await page.getByLabel('Level dimension', { exact: true }).selectOption(dimension);
	await capture?.(page, 'level-brief-' + dimension);
	await page.getByRole('button', { name: 'Generate level', exact: true }).click();
	await expect(page.locator('canvas[data-level-preview][data-ready=true]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Build level', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
	await capture?.(page, 'level-review-' + dimension);
	await page.getByRole('button', { name: 'Approve level', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Build level', exact: true })).toBeEnabled();
	await capture?.(page, 'level-approved-' + dimension);
	await page.getByRole('button', { name: 'Build level', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeEnabled();
}

/** A level is planned and approved before checkpoints, for both dimensions and every viewport. */
export async function exerciseLevelPlanning(
	page: Page,
	capture: (page: Page, name: string) => Promise<void>
) {
	await installLevelProject(page);
	for (const dimension of ['2d', '3d'])
		for (const [width, height] of [
			[1440, 900],
			[920, 1180],
			[390, 844]
		]) {
			await page.setViewportSize({ width, height });
			await page.goto(levelProject);
			await viewSettings(page);
			await capture(page, 'level-entry-' + dimension);
			await expect(page.getByRole('button', { name: 'New level', exact: true })).toBeVisible();
			await page.getByRole('button', { name: 'New level', exact: true }).click();
			await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
			await capture(page, 'level-concept-' + dimension);
			await buildLevel(page, dimension, capture);
			await capture(page, 'level-built-' + dimension);
			await page.getByRole('button', { name: 'Save', exact: true }).click();
			const stored = await page.evaluate(() =>
				JSON.parse(localStorage.getItem('level-document') ?? 'null')
			);
			expect(stored.views.at(-1).world.objects).toHaveLength(2);
			expect(stored.views.at(-1).planning.built).toBe(stored.views.at(-1).planning.proposal.id);
			await page.getByRole('button', { name: 'Edit brief', exact: true }).click();
			await page
				.getByLabel('Level brief', { exact: true })
				.fill('A wider island with another wall.');
			await expect(page.getByRole('button', { name: 'Checkpoints', exact: true })).toBeDisabled();
			await capture(page, 'level-stale-' + dimension);
			await page.getByRole('button', { name: 'Save', exact: true }).click();
			await page.evaluate(() => localStorage.removeItem('level-document'));
		}
	await page.goto('/game');
}
