import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import type { ComponentManifest, ScenarioManifest } from '../../src/core/unitTypes';
import { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { TestDiscoveryService } from '../../src/services/verification-evidence/TestDiscoveryService';
import { generatePiece } from '../../src/workflows/generate-code/generateCode';
import { unitProject } from './unitProject';

/** Visual generation from a nested workspace registers repository-relative cases and its build. */
export async function assertGeneratedWorkspaceRegistry(): Promise<void> {
	const project = await unitProject('app');
	const workspace = 'packages/portal';
	try {
		const config = await project.json<{ workspaces: { name: string; root: string }[] }>(
			'harness.units.json'
		);
		config.workspaces.push({ name: 'portal', root: workspace });
		await project.write('harness.units.json', JSON.stringify(config));
		const verify = await project.json<{ builds: { id: string; directory: string }[] }>(
			'harness.verify.json'
		);
		verify.builds.push({ id: 'portal', directory: `${workspace}/build` });
		await project.write('harness.verify.json', JSON.stringify(verify));
		await project.write(`${workspace}/package.json`, JSON.stringify({ harness: { kind: 'app' } }));
		for (const [kind, name] of [
			['component', 'WorkspaceCard'],
			['view', 'WorkspaceDashboard'],
			['layout', 'WorkspaceShell']
		] as const)
			await generatePiece({ root: join(project.root, workspace), kind, name });
		await project.harness(['units', 'index', '--write']);
		for (const entry of [
			{
				unit: 'portal.component.workspace-card',
				file: 'workspace-card-component.spec.ts',
				shape: 'component'
			},
			{
				unit: 'portal.page.workspace-dashboard',
				file: 'workspace-dashboard-page.spec.ts',
				shape: 'page'
			},
			{
				unit: 'portal.layout.workspace-shell',
				file: 'workspace-shell-layout.spec.ts',
				shape: 'page'
			}
		] as const) {
			const unit = await project.json<ComponentManifest>(`specification/units/${entry.unit}.json`);
			expect(unit.testing, `${entry.unit} has a generated workspace contract`).toBeDefined();
			const scenarioId = entry.unit.replace('.', '-');
			const scenario = await project.json<ScenarioManifest>(
				`specification/scenarios/${scenarioId}.json`
			);
			await assertWorkspaceMatrix(project.read, unit, scenario, { ...entry, workspace });
		}
	} finally {
		await rm(dirname(project.root), { recursive: true, force: true });
	}
}

async function assertWorkspaceMatrix(
	read: (path: string) => Promise<string>,
	unit: ComponentManifest,
	scenario: ScenarioManifest,
	entry: { workspace: string; file: string; shape: 'page' | 'component' }
) {
	const testFile = `${entry.workspace}/tests/e2e/${entry.file}`;
	const found = await new TestDiscoveryService().discover({ read }, [testFile]);
	expect(found.errors).toEqual([]);
	expect(unit.testing!.shape).toBe(entry.shape);
	expect(unit.owns.source.every((path) => path.startsWith(`${entry.workspace}/src/`))).toBe(true);
	expect(unit.testing!.cases.every((item) => item.test.file === testFile)).toBe(true);
	expect(
		unit.testing!.cases.every(
			(item) =>
				item.expected?.kind === 'screenshot' &&
				item.expected.file.startsWith(`${entry.workspace}/.cache/harness/visual-baselines/`)
		)
	).toBe(true);
	expect(scenario.tests).toContainEqual(
		expect.objectContaining({
			cwd: entry.workspace,
			target: `tests/e2e/${entry.file}`,
			runner: 'playwright'
		})
	);
	expect(scenario.evidence).toContainEqual(
		expect.objectContaining({ kind: 'screenshot', build: 'portal', provenance: 'actual-capture' })
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
