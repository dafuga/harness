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
}

function validationFixture(
	detail: { commit: string; registry: { units: Array<{ id: string }> } },
	repaired: boolean
) {
	const empty = {
		pages: [],
		layouts: [],
		components: [],
		functions: [],
		configs: [],
		services: [],
		types: [],
		apis: [],
		models: [],
		usedBy: [],
		support: []
	};
	const moduleData = {
		required: true,
		committed: true,
		commit: detail.commit,
		issues: [],
		modules: repaired
			? []
			: [
					{
						id: 'function.slugify',
						kind: 'function',
						category: 'functions',
						issues: [
							{
								field: 'contract.inputs',
								message: 'Missing input description',
								repair: 'Commit the reviewed contract'
							}
						]
					}
				],
		relationships: Object.fromEntries(
			detail.registry.units.map((unit: { id: string }) => [unit.id, empty])
		)
	};
	return moduleData;
}
