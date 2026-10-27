import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';
import type { ComponentManifest, ScenarioManifest } from '../../src/core/unitTypes';
import { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { TestDiscoveryService } from '../../src/services/verification-evidence/TestDiscoveryService';
import { generatePiece } from '../../src/workflows/generate-code/generateCode';
import { unitProject } from './unitProject';
import type { UnitProject } from './unitProject';

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
		await assertMissingWorkspaceBuild(project, config);
		await assertAmbiguousWorkspaceBuild(project, config, verify);
		await assertUndeclaredWorkspace(project);
		await assertOrphanedVisualRegistry(project);
	} finally {
		await rm(dirname(project.root), { recursive: true, force: true });
	}
}

async function assertOrphanedVisualRegistry(project: UnitProject) {
	const root = 'packages/portal';
	for (const entry of [
		{
			kind: 'component',
			name: 'OrphanCard',
			registry: 'specification/units/portal.component.orphan-card.json',
			source: `${root}/src/components/OrphanCard.svelte`
		},
		{
			kind: 'view',
			name: 'OrphanPage',
			registry: 'specification/scenarios/portal-page.orphan-page.json',
			source: `${root}/src/routes/orphan-page/+page.svelte`
		}
	] as const) {
		const authored = '{"authored":"preserve this orphan"}';
		await project.write(entry.registry, authored);
		const failure = await generatePiece({
			root: join(project.root, root),
			kind: entry.kind,
			name: entry.name
		}).then(
			() => undefined,
			(error: unknown) => error
		);
		expect(failure, 'Orphaned visual metadata blocks generation').toBeInstanceOf(Error);
		expect((failure as Error).message).toContain(
			'Visual registry exists without its generated source'
		);
		expect(await project.read(entry.registry)).toBe(authored);
		await expect(project.read(entry.source)).rejects.toMatchObject({ code: 'ENOENT' });
	}
}

async function assertAmbiguousWorkspaceBuild(
	project: UnitProject,
	config: { workspaces: { name: string; root: string }[] },
	verify: { builds: { id: string; directory: string }[] }
) {
	const root = 'packages/ambiguous';
	config.workspaces.push({ name: 'ambiguous', root });
	verify.builds.push(
		{ id: 'first', directory: `${root}/output-one` },
		{ id: 'second', directory: `${root}/output-two` }
	);
	await project.write('harness.units.json', JSON.stringify(config));
	await project.write('harness.verify.json', JSON.stringify(verify));
	await project.write(`${root}/package.json`, JSON.stringify({ harness: { kind: 'app' } }));
	await expect(
		generatePiece({ root: join(project.root, root), kind: 'view', name: 'AmbiguousPage' })
	).rejects.toThrow('Multiple screenshot builds for workspace packages/ambiguous');
	await expect(
		project.read(`${root}/src/routes/ambiguous-page/+page.svelte`)
	).rejects.toMatchObject({ code: 'ENOENT' });
}

async function assertUndeclaredWorkspace(project: UnitProject) {
	const root = 'packages/unregistered';
	await project.write(`${root}/package.json`, JSON.stringify({ harness: { kind: 'app' } }));
	await expect(
		generatePiece({ root: join(project.root, root), kind: 'layout', name: 'UnknownLayout' })
	).rejects.toThrow('Workspace packages/unregistered is not declared in harness.units.json');
	await expect(
		project.read(`${root}/src/routes/unknown-layout/+layout.svelte`)
	).rejects.toMatchObject({ code: 'ENOENT' });
}

async function assertMissingWorkspaceBuild(
	project: UnitProject,
	config: { workspaces: { name: string; root: string }[] }
) {
	config.workspaces.push({ name: 'unbuilt', root: 'packages/unbuilt' });
	await project.write('harness.units.json', JSON.stringify(config));
	await project.write(
		'packages/unbuilt/package.json',
		JSON.stringify({ harness: { kind: 'app' } })
	);
	await expect(
		generatePiece({
			root: join(project.root, 'packages/unbuilt'),
			kind: 'component',
			name: 'UnbuiltCard'
		})
	).rejects.toThrow('No declared screenshot build for workspace packages/unbuilt');
	await expect(
		project.read('packages/unbuilt/src/components/UnbuiltCard.svelte')
	).rejects.toMatchObject({ code: 'ENOENT' });
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
