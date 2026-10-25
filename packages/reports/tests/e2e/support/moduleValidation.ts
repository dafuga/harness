import { explorerCategory } from '../../../src/utils/explorer-ui/explorerCategory';
import type { HarnessRevision, HarnessUnit } from '../../../src/models/Harness.types';
import { moduleRelationships } from '../../../../../src/services/git-source-history/module-data-service/moduleRelationships';
import { modelDefinition } from '../../../test/entityClassFixtures';
import { expect, type Page } from '../../../../../test/support/browserTest';
import { at, checkpoint } from './explorer';
import { seeded } from './harnessHistory';
import type { Viewport } from './harnessCapture.types';

/** The normal catalog matrix exercises admission and repair through the real app loader. */
export async function moduleValidation(page: Page, viewport: Viewport): Promise<void> {
	let repaired = false;
	await page.setViewportSize({ width: viewport.width, height: viewport.height });
	await page.route('**/harness/data/revisions/*.json', async (route) => {
		const response = await route.fetch(),
			detail = await response.json();
		const moduleData = validationFixture(detail, repaired);
		await route.fulfill({ response, json: { ...detail, moduleData } });
	});
	const url = at('main', seeded().commits.approved, 'functions');
	await page.goto(url);
	await page.waitForLoadState('networkidle');
	await checkpoint(page, `metadata-incomplete-${viewport.id}`, 'metadata-incomplete');
	await expect(page.getByRole('main')).toContainText('function.slugify: contract.inputs');
	await expect(page.getByRole('main').getByRole('article')).toHaveCount(0);
	repaired = true;
	await page.reload();
	await page.waitForLoadState('networkidle');
	await checkpoint(page, `metadata-repaired-${viewport.id}`, 'metadata-repaired');
	await expect(page.getByRole('heading', { level: 1, name: 'Helpers' })).toBeVisible();
	await expect(page.getByRole('main')).not.toContainText('Incomplete module data');
	await expect(page.getByRole('main').getByRole('article')).toHaveCount(1);
}

function validationFixture(detail: HarnessRevision, repaired: boolean) {
	if (!detail.moduleData?.committed)
		throw new Error(
			'The seeded source must commit its module data before browser admission checks.'
		);
	const moduleData = {
		required: true,
		committed: true,
		commit: detail.commit,
		issues: [],
		modules: detail.registry.units
			.filter((unit) => unit.status === 'active')
			.map((unit) => ({
				id: unit.id,
				kind: unit.kind,
				category: explorerCategory(unit),
				issues:
					!repaired && unit.id === 'function.slugify'
						? [
								{
									field: 'contract.inputs',
									message: 'Missing input description',
									repair: 'Commit the reviewed contract'
								}
							]
						: []
			})),
		relationships: detail.moduleData.relationships
	};
	return moduleData;
}

/** Mock registry growth always authors the matching admission data before the app reads it. */
export function appendFixtureModules(
	detail: HarnessRevision,
	units: HarnessUnit[]
): HarnessRevision {
	if (!detail.moduleData?.committed)
		throw new Error('Synthetic module fixtures require admitted seed data.');
	detail.registry.units.push(...units);
	const registry = {
		...detail.registry,
		graph: {
			...detail.registry.graph,
			nodes: [
				...detail.registry.units.map((unit) => ({ id: `unit:${unit.id}`, kind: 'unit' as const })),
				...detail.registry.scenarios.map((scenario) => ({
					id: `scenario:${scenario.id}`,
					kind: 'scenario' as const
				}))
			]
		}
	};
	detail.registry = registry;
	detail.moduleData.relationships = moduleRelationships(registry);
	detail.moduleData.modules.push(
		...units
			.filter((unit) => unit.status === 'active')
			.map((unit) => ({
				id: unit.id,
				kind: unit.kind,
				category: explorerCategory(unit),
				issues: []
			}))
	);
	return detail;
}

/** A synthetic database-model wrapper for the standard category and measurement matrix. */
export function addAcceptanceModel(detail: HarnessRevision): HarnessRevision {
	const template = detail.registry.units.find((unit) => unit.kind === 'config')!;
	const id = 'model.acceptance-payload';
	return appendFixtureModules(detail, [
		{
			...template,
			id,
			kind: 'model',
			title: 'Acceptance payload',
			catalog: { visibility: 'public' },
			responsibility: 'Synthetic model input for category acceptance; it describes no real source.',
			modelDefinitions: [modelDefinition('AcceptancePayload', template.owns.source[0])],
			sourceMeasurements: template.sourceMeasurements?.map((item) => ({
				...item,
				unit: id,
				method:
					'Synthetic model observations copied from the config fixture for category acceptance.'
			}))
		}
	]);
}
