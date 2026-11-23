import { gridFolder, contract, gridManifest } from './function.planning-artifact-paths.fixture';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import { planningArtifactPaths } from '../../src/audit/development-tooling/structure-rules/planningArtifactPaths';
import { canonicalJson } from '../../src/utils/development-tooling/canonicalJson';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/**
 * planningArtifactPaths is called the way structureRules calls it: with the project root and the
 * repository's file list. Plans and unit manifests are stored in a temporary project folder; each
 * call's root and files, and the sorted paths it accepted, are asserted and recorded as cases.
 */

const unitId = 'function.planning-artifact-paths';
const project = 'temporary project folder';
const recorded = { unitId, symbol: 'planningArtifactPaths', evidence: 'examples-cases' };
const caseFile = (state: string) => ({ ...recorded, state, file: `${state}.json` });
const hashOf = (value: object) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const sorted = (paths: string[]) => [...paths].sort();
const input = (files: string[], changed: object = {}) => ({ root: project, files, ...changed });
const caseOf = (name: string, given: object, output: string[]) => ({ name, input: given, output });

const revision = '0123456789abcdef0123456789abcdef01234567';
const folder = 'src/functions/planning-artifact-paths';
const planPath = `${folder}/plan.json`;
const version = `${folder}/designs/v001`;
const designs = [`${version}/design.json`, `${version}/prompt.md`, `${version}/notes.md`];
const approval = `${folder}/designs/approvals/0b9e4c1a-2d3f-4a5b-8c6d-7e8f9a0b1c2d.json`;
const readme = 'src/services/billing-ledger/README.md';
const gridPlanPath = `${gridFolder}/plan.json`;
const gridManifestPath = 'specification/units/reports.component.evidence-grid.json';
const gridThread = `${gridFolder}/threads/3f1c9a2e-6b7d-4e8f-9a0b-1c2d3e4f5a6b/messages.ndjson`;
const gridImage = `${gridFolder}/designs/v002/hero-desktop.png`;
const gridArtifacts = [gridPlanPath, gridThread, gridImage];
const functionPlan = {
	unitId,
	category: 'function',
	slug: 'planning-artifact-paths',
	path: folder,
	title: 'Validated planning artifact paths',
	goal: 'Accept exact planning artifacts only under a valid plan.',
	createdAt: '2026-11-15T09:00:00.000Z',
	createdBy: { kind: 'agent', name: 'example-planner' },
	baseRevision: revision,
	contract,
	contractHash: hashOf(contract)
};
const gridPlan = {
	...functionPlan,
	unitId: 'reports.component.evidence-grid',
	category: 'component',
	slug: 'evidence-grid',
	path: gridFolder,
	title: 'Evidence grid',
	goal: 'Shows the evidence rows of one report as a grid.'
};

const planDirs = ['src/', 'src/functions/', `${folder}/`];
const designDirs = [`${folder}/designs/`, `${version}/`];
const approvalDirs = [`${folder}/designs/`, `${folder}/designs/approvals/`];
const gridDirs = [
	'src/',
	'src/components/',
	`${gridFolder}/`,
	`${gridFolder}/threads/`,
	`${gridFolder}/threads/3f1c9a2e-6b7d-4e8f-9a0b-1c2d3e4f5a6b/`,
	`${gridFolder}/designs/`,
	`${gridFolder}/designs/v002/`
];
const planOnly = sorted([planPath, ...planDirs]);
const planAndDesigns = sorted([planPath, ...designs, ...planDirs, ...designDirs]);
const approvalAccepted = sorted([planPath, approval, ...planDirs, ...approvalDirs]);
const gridAccepted = sorted([...gridArtifacts, ...gridDirs]);

/** Writes each repository-relative file under the temporary project folder; objects are JSON. */
async function writeProject(root: string, files: Record<string, unknown>): Promise<void> {
	for (const [path, value] of Object.entries(files)) {
		const text = typeof value === 'string' ? value : `${JSON.stringify(value, null, '\t')}\n`;
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), text);
	}
}

/** The accepted paths, sorted as a caller lists them. */
function accepted(root: string | undefined, files: string[]): string[] {
	return sorted([...planningArtifactPaths(root, files)]);
}

/** Stores one plan where the planning workflow keeps it, then calls the function on the files. */
async function storedAccepted(root: string, plan: object, files: string[]): Promise<string[]> {
	await writeProject(root, { [planPath]: plan });
	return accepted(root, files);
}

test('Accepts the listed artifacts of a function plan with their ancestor directories', async () => {
	await withTempDir('planning-artifact-paths-', async (root) => {
		await writeProject(root, { [planPath]: functionPlan });
		const designFiles = [planPath, ...designs];
		const signedFiles = [planPath, approval, readme];
		const design = accepted(root, designFiles);
		const signed = accepted(root, signedFiles);
		expect([design, signed]).toEqual([planAndDesigns, approvalAccepted]);
		recordExampleCases(caseFile('accepts-the-listed-artifacts-of-a-function-plan-with-their-a'), [
			caseOf('design files listed', input(designFiles), design),
			caseOf('approval listed, README outside', input(signedFiles), signed)
		]);
	});
});

test('Accepts a component plan only when its listed unit manifest names the same unit', async () => {
	await withTempDir('planning-artifact-paths-', async (root) => {
		const files = [gridPlanPath, gridManifestPath, gridThread, gridImage];
		await writeProject(root, { [gridPlanPath]: gridPlan, [gridManifestPath]: gridManifest });
		const listed = accepted(root, files);
		const unlisted = accepted(root, gridArtifacts);
		const otherUnit = { ...gridManifest, id: 'reports.component.evidence-list' };
		await writeProject(root, { [gridManifestPath]: otherUnit });
		const named = accepted(root, files);
		expect([listed, unlisted, named]).toEqual([gridAccepted, [], []]);
		recordExampleCases(caseFile('accepts-a-component-plan-only-when-its-listed-unit-manifest'), [
			caseOf('manifest listed, names the plan unit', input(files), listed),
			caseOf('manifest on disk, not listed', input(gridArtifacts), unlisted),
			caseOf('listed manifest names another unit', input(files), named)
		]);
	});
});

test('Accepts a plan only when its contract hash matches the contract it stores', async () => {
	await withTempDir('planning-artifact-paths-', async (root) => {
		const files = [planPath, ...designs];
		const stored = functionPlan.contractHash;
		const foreign = hashOf({ ...contract, responsibility: 'Another responsibility.' });
		const edited = { ...contract, errors: ['Added after the hash was stored.'] };
		const matching = await storedAccepted(root, functionPlan, files);
		const otherHash = await storedAccepted(root, { ...functionPlan, contractHash: foreign }, files);
		const afterEdit = await storedAccepted(root, { ...functionPlan, contract: edited }, files);
		expect([matching, otherHash, afterEdit]).toEqual([planAndDesigns, [], []]);
		recordExampleCases(caseFile('accepts-a-plan-only-when-its-contract-hash-matches-the-contr'), [
			caseOf('stored hash', input(files, { contractHash: stored }), matching),
			caseOf('hash of another contract', input(files, { contractHash: foreign }), otherHash),
			caseOf('contract edited after hashing', input(files, { contract: edited }), afterEdit)
		]);
	});
});

test('Accepts a plan only when its folder, path and base revision match its declaration', async () => {
	await withTempDir('planning-artifact-paths-', async (root) => {
		const files = [planPath, ...designs];
		const asComponent = { ...functionPlan, category: 'component' };
		const movedPath = { ...functionPlan, path: 'src/functions/planning-artifacts' };
		const badRevision = { ...functionPlan, baseRevision: 'main' };
		const matching = await storedAccepted(root, functionPlan, files);
		const wrongCategory = await storedAccepted(root, asComponent, files);
		const wrongPath = await storedAccepted(root, movedPath, files);
		const wrongRevision = await storedAccepted(root, badRevision, files);
		expect(matching).toEqual(planAndDesigns);
		expect([wrongCategory, wrongPath, wrongRevision]).toEqual([[], [], []]);
		recordExampleCases(caseFile('accepts-a-plan-only-when-its-folder-path-and-base-revision-m'), [
			caseOf('declarations agree', input(files, { path: folder }), matching),
			caseOf('category component', input(files, { category: 'component' }), wrongCategory),
			caseOf('path names another folder', input(files, { path: movedPath.path }), wrongPath),
			caseOf('base revision not a commit', input(files, { baseRevision: 'main' }), wrongRevision)
		]);
	});
});

test('Refuses artifacts that are unlisted, unsupported or outside a validated plan', async () => {
	await withTempDir('planning-artifact-paths-', async (root) => {
		const badVersion = `${folder}/designs/v1/design.json`;
		const badApproval = `${folder}/designs/approvals/not-a-uuid.json`;
		const script = `${folder}/designs/v001/tests.ts`;
		const badNames = [planPath, badVersion, badApproval, script];
		await writeProject(root, { [planPath]: functionPlan, [designs[0]]: '{}\n' });
		const unlisted = accepted(root, [planPath]);
		const unsupported = accepted(root, badNames);
		const outside = accepted(root, [readme]);
		expect([unlisted, unsupported, outside]).toEqual([planOnly, planOnly, []]);
		recordExampleCases(caseFile('refuses-artifacts-that-are-unlisted-unsupported-or-outside-a'), [
			caseOf('design on disk, not listed', input([planPath]), unlisted),
			caseOf('bad version, approval and script', input(badNames), unsupported),
			caseOf('README with no plan in its folder', input([readme]), outside)
		]);
	});
});

test('Returns an empty set for an undefined or empty project root', async () => {
	await withTempDir('planning-artifact-paths-', async (root) => {
		await writeProject(root, { [planPath]: functionPlan });
		const files = [planPath, ...designs];
		const noRoot = accepted(undefined, files);
		const emptyRoot = accepted('', files);
		const realRoot = accepted(root, files);
		expect([noRoot, emptyRoot, realRoot]).toEqual([[], [], planAndDesigns]);
		recordExampleCases(caseFile('returns-an-empty-set-for-an-undefined-or-empty-project-root'), [
			caseOf('root is undefined', input(files, { root: undefined }), noRoot),
			caseOf('root is an empty string', input(files, { root: '' }), emptyRoot),
			caseOf('root is the project folder', input(files), realRoot)
		]);
	});
});
