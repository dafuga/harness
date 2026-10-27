import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { expect } from 'vitest';
import type { ComponentManifest, ScenarioManifest } from '../../src/core/unitTypes';
import { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { TestDiscoveryService } from '../../src/services/verification-evidence/TestDiscoveryService';
import { ComponentManifestValidator } from '../../src/validators/development-tooling/ComponentManifestValidator';
import { ScenarioManifestValidator } from '../../src/validators/verification-evidence/ScenarioManifestValidator';
import { generatePiece } from '../../src/workflows/generate-code/generateCode';
import { unitProject } from './unitProject';

/** Pages and layouts must register the same screenshot form, including the layout child slot. */
export async function assertGeneratedPageLayoutRegistry(): Promise<void> {
	const project = await unitProject('app');
	try {
		await generatePiece({ root: project.root, kind: 'view', name: 'Dashboard' });
		await generatePiece({ root: project.root, kind: 'layout', name: 'AppShell', group: 'catalog' });
		await project.harness(['units', 'index', '--write']);
		for (const entry of [
			{ unit: 'page.dashboard', scenario: 'page-dashboard', route: 'dashboard', kind: 'page' },
			{
				unit: 'layout.catalog-app-shell',
				scenario: 'layout-catalog-app-shell',
				route: 'app-shell',
				kind: 'layout'
			}
		] as const) {
			const unitFile = `specification/units/${entry.unit}.json`;
			const scenarioFile = `specification/scenarios/${entry.scenario}.json`;
			const unit = await project.json<ComponentManifest>(unitFile);
			expect(unit.testing, `${entry.unit} has a generated page contract`).toBeDefined();
			const scenario = await project.json<ScenarioManifest>(scenarioFile);
			expect(new ComponentManifestValidator().validate(unit, unitFile).errors).toEqual([]);
			expect(new ScenarioManifestValidator().validate(scenario, scenarioFile).errors).toEqual([]);
			await assertMatrix(project.read, unit, scenario, entry);
		}
		const layout = await project.read('src/routes/(catalog)/app-shell/+layout.svelte');
		const placeholder = await project.read('src/routes/(catalog)/app-shell/__harness/+page.svelte');
		const test = await project.read('tests/e2e/app-shell-layout.spec.ts');
		expect(layout).toContain('{@render children()}');
		expect(placeholder).toContain('Child content placeholder');
		expect(test).toContain("toContainText('Child content placeholder')");
	} finally {
		await rm(dirname(project.root), { recursive: true, force: true });
	}
}

async function assertMatrix(
	read: (path: string) => Promise<string>,
	unit: ComponentManifest,
	scenario: ScenarioManifest,
	entry: { route: string; kind: 'page' | 'layout' }
) {
	const { route, kind } = entry;
	const states = kind === 'page' ? ['default', 'error-state'] : ['default'];
	const testFile = `tests/e2e/${route}-${kind}.spec.ts`;
	const suite = kind === 'page' ? `${route} view route is generated` : `${route} layout frame`;
	const found = await new TestDiscoveryService().discover({ read }, [testFile]);
	expect(found.errors).toEqual([]);
	expect(unit.testing).toMatchObject({ shape: 'page', states });
	expect(unit.testing!.props).toEqual(kind === 'page' ? ['error'] : ['children']);
	expect(
		unit.testing!.cases.map(({ id, state, test, viewports, expected }) => ({
			id,
			state,
			test,
			viewports,
			expected
		}))
	).toEqual(
		['desktop', 'tablet', 'mobile'].flatMap((viewport) =>
			states.map((state) => ({
				id: `${state}.${viewport}`,
				state,
				test: { file: testFile, title: `${suite} > ${viewport} viewport > ${state}` },
				viewports: [viewport],
				expected: {
					kind: 'screenshot',
					file: `.cache/harness/visual-baselines/${route}-${kind}.spec.ts/${route}-${kind}-${state === 'error-state' ? 'error' : state}-${viewport}.png`
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
	expect(scenario.evidence).toContainEqual(
		expect.objectContaining({ kind: 'screenshot', capture: 'full-page', required: true })
	);
}
