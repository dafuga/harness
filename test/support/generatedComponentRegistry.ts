import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect } from 'vitest';
import type { ComponentManifest, ScenarioManifest } from '../../src/core/unitTypes';
import { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { TestDiscoveryService } from '../../src/services/verification-evidence/TestDiscoveryService';
import { generatePiece } from '../../src/workflows/generate-code/generateCode';
import { unitProject } from './unitProject';

/** Generated cases retain their identities through indexing, including categorized components. */
export async function assertGeneratedComponentRegistry(): Promise<void> {
	const project = await unitProject('app');
	try {
		await generatePiece({ root: project.root, kind: 'component', name: 'PostCard' });
		await generatePiece({
			root: project.root,
			kind: 'component',
			name: 'StatusChip',
			group: 'catalog'
		});
		await project.harness(['units', 'index', '--write']);
		for (const [unitId, symbol, file] of [
			['component.post-card', 'PostCard', 'post-card'],
			['component.catalog-status-chip', 'StatusChip', 'status-chip']
		] as const) {
			const unit = await project.json<ComponentManifest>(`specification/units/${unitId}.json`);
			expect(unit.testing, `${unitId} has a generated component contract`).toBeDefined();
			const scenarioId = unitId.replace('.', '-');
			const scenario = await project.json<ScenarioManifest>(
				`specification/scenarios/${scenarioId}.json`
			);
			await assertMatrix(project.read, unit, scenario, symbol, file);
		}
	} finally {
		await rm(dirname(project.root), { recursive: true, force: true });
	}
}

async function assertMatrix(
	read: (path: string) => Promise<string>,
	unit: ComponentManifest,
	scenario: ScenarioManifest,
	symbol: string,
	file: string
) {
	const testFile = `tests/e2e/${file}-component.spec.ts`;
	const found = await new TestDiscoveryService().discover({ read }, [testFile]);
	expect(found.errors).toEqual([]);
	const cases = unit.testing!.cases;
	expect(unit.testing).toMatchObject({
		shape: 'component',
		states: ['rest', 'label-prop', 'error-prop'],
		props: ['label', 'error']
	});
	expect(
		cases.map(({ id, state, test, viewports, expected }) => ({
			id,
			state,
			test,
			viewports,
			expected
		}))
	).toEqual(
		['desktop', 'tablet', 'mobile'].flatMap((viewport) =>
			['rest', 'label-prop', 'error-prop'].map((state) => ({
				id: `${state}.${viewport}`,
				state,
				test: {
					file: testFile,
					title: `${symbol}.svelte states > ${viewport} viewport > ${state}`
				},
				viewports: [viewport],
				expected: {
					kind: 'screenshot',
					file: `.cache/harness/visual-baselines/${file}-component.spec.ts/${file}-${state}-${viewport}.png`
				}
			}))
		)
	);
	expect(
		new TestContractService().validate({
			units: [unit],
			scenarios: [scenario],
			files: new Set([testFile]),
			tests: found.tests,
			required: true
		})
	).toEqual([]);
}
