import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { modulePackagePlan, moduleGroupPlan } from '../../src/services/module-system/modulePlan';
import type { ModuleDefinition } from '../../src/services/module-system/moduleDefinition.types';

const gridDefinition: ModuleDefinition = {
	schemaVersion: 1,
	id: 'evidence-grid',
	version: '1.2.0',
	title: 'Evidence grid',
	description: 'Sortable evidence table for report screens.',
	appOnly: true,
	instructions: ['Render the grid from the report evidence list.'],
	setup: [],
	dependencies: { '@tanstack/react-table': '^8.20.0' },
	resources: []
};

const appManifest = {
	name: 'harness-app',
	version: '0.1.0',
	harness: { kind: 'app' }
};

function writeJson(directory: string, name: string, value: unknown) {
	writeFileSync(join(directory, name), JSON.stringify(value));
}

async function captureError(run: () => Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (error) {
		return error as Error;
	}
	throw new Error('Expected the call to reject');
}

test('Merges module dependencies into an app manifest', async () => {
	await withTempDir('module-plan-app-', async (root) => {
		writeJson(root, 'package.json', appManifest);
		const plan = await modulePackagePlan(root, gridDefinition);
		const manifest = JSON.parse(plan.contents);

		expect(plan.path).toBe('package.json');
		expect(manifest.name).toBe('harness-app');
		expect(manifest.harness).toEqual({ kind: 'app' });
		expect(manifest.dependencies).toEqual({ '@tanstack/react-table': '^8.20.0' });
		expect(plan.contents.endsWith('\n')).toBe(true);
		recordExampleCases(
			{
				unitId: 'service.module-system-module-plan',
				symbol: 'modulePackagePlan',
				state: 'merges-module-dependencies-into-an-app-manifest',
				evidence: 'examples-cases',
				file: 'merges-module-dependencies-into-an-app-manifest.json'
			},
			[
				{
					name: 'app manifest gains the grid dependency and keeps its harness kind',
					input: { root: 'harness-app', definition: 'evidence-grid' },
					output: { path: plan.path, manifest }
				}
			]
		);
	});
});

test('Rejects a conflicting existing dependency version', async () => {
	await withTempDir('module-plan-conflict-', async (root) => {
		writeJson(root, 'package.json', {
			...appManifest,
			dependencies: { '@tanstack/react-table': '^7.0.0' }
		});
		const error = await captureError(() => modulePackagePlan(root, gridDefinition));

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toContain('@tanstack/react-table');
		recordExampleCases(
			{
				unitId: 'service.module-system-module-plan',
				symbol: 'modulePackagePlan',
				state: 'rejects-a-conflicting-existing-dependency-version',
				evidence: 'examples-cases',
				file: 'rejects-a-conflicting-existing-dependency-version.json'
			},
			[
				{
					name: 'existing react-table 7 blocks the module requesting 8',
					input: { existing: '^7.0.0', requested: '^8.20.0' },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Rejects an app-only module outside an app project', async () => {
	await withTempDir('module-plan-kind-', async (root) => {
		writeJson(root, 'package.json', { name: 'shared-lib', harness: { kind: 'library' } });
		const error = await captureError(() => modulePackagePlan(root, gridDefinition));

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe('This module requires a Harness app project.');
		recordExampleCases(
			{
				unitId: 'service.module-system-module-plan',
				symbol: 'modulePackagePlan',
				state: 'rejects-an-app-only-module-outside-an-app-project',
				evidence: 'examples-cases',
				file: 'rejects-an-app-only-module-outside-an-app-project.json'
			},
			[
				{
					name: 'library project cannot receive an app-only module',
					input: { harnessKind: 'library', appOnly: true },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Appends the module group to a missing taxonomy', async () => {
	await withTempDir('module-plan-groups-', async (root) => {
		const plan = await moduleGroupPlan(root, { id: 'evidence-grid', title: 'Evidence grid' });
		const config = JSON.parse(plan.contents);

		expect(plan.path).toBe('harness.groups.json');
		expect(config.schemaVersion).toBe(1);
		expect(config.groups).toEqual([
			{ id: 'evidence-grid', title: 'Evidence grid', terms: ['evidence-grid'] }
		]);
		expect(config.legacy).toEqual([]);
		recordExampleCases(
			{
				unitId: 'service.module-system-module-plan',
				symbol: 'moduleGroupPlan',
				state: 'appends-the-module-group-to-a-missing-taxonomy',
				evidence: 'examples-cases',
				file: 'appends-the-module-group-to-a-missing-taxonomy.json'
			},
			[
				{
					name: 'missing harness.groups.json starts empty and gains the grid group',
					input: { root: 'empty-project', definition: 'evidence-grid' },
					output: { path: plan.path, config }
				}
			]
		);
	});
});

test('Leaves an existing module group unchanged', async () => {
	await withTempDir('module-plan-existing-', async (root) => {
		const existing = {
			schemaVersion: 1,
			groups: [{ id: 'evidence-grid', title: 'Old grid title', terms: ['evidence-grid'] }],
			legacy: []
		};
		writeJson(root, 'harness.groups.json', existing);
		const plan = await moduleGroupPlan(root, { id: 'evidence-grid', title: 'Evidence grid' });
		const config = JSON.parse(plan.contents);

		expect(config.groups).toHaveLength(1);
		expect(config.groups[0].title).toBe('Old grid title');
		recordExampleCases(
			{
				unitId: 'service.module-system-module-plan',
				symbol: 'moduleGroupPlan',
				state: 'leaves-an-existing-module-group-unchanged',
				evidence: 'examples-cases',
				file: 'leaves-an-existing-module-group-unchanged.json'
			},
			[
				{
					name: 'group with the same id keeps its original title',
					input: { existingTitle: 'Old grid title', definition: 'evidence-grid' },
					output: { path: plan.path, config }
				}
			]
		);
	});
});
