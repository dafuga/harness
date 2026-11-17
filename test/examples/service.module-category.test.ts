import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { ModuleCategoryService } from '../../src/services/development-tooling/ModuleCategoryService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const taxonomy = {
	schemaVersion: 1,
	groups: [{ id: 'reports', title: 'Reports', terms: ['evidence', 'export'] }],
	legacy: ['src/services/LegacyExport.ts']
};

const service = new ModuleCategoryService();

test('Loads the nearest project taxonomy', async () => {
	await withTempDir('module-category-load-', (directory) => {
		const nested = join(directory, 'apps', 'web', 'src');
		mkdirSync(nested, { recursive: true });
		writeFileSync(join(directory, 'harness.groups.json'), JSON.stringify(taxonomy));
		const result = service.load(nested);
		expect(result).toEqual({ root: directory, config: taxonomy });
		recordExampleCases(
			{
				unitId: 'service.module-category',
				symbol: 'ModuleCategoryService.load',
				state: 'loads-the-nearest-project-taxonomy',
				evidence: 'examples-cases',
				file: 'loads-the-nearest-project-taxonomy.json'
			},
			[{ name: 'loads reports taxonomy from its project root', input: { directory: nested }, output: result }]
		);
	});
});

test('Reads taxonomy from a selected source tree', async () => {
	const reads: string[] = [];
	const result = await service.at({
		read: async (path) => {
			reads.push(path);
			return JSON.stringify(taxonomy);
		}
	});
	expect(result).toEqual(taxonomy);
	recordExampleCases(
		{
			unitId: 'service.module-category',
			symbol: 'ModuleCategoryService.at',
			state: 'reads-taxonomy-from-a-selected-source-tree',
			evidence: 'examples-cases',
			file: 'reads-taxonomy-from-a-selected-source-tree.json'
		},
		[{ name: 'reads and validates the selected revision taxonomy', input: { path: 'harness.groups.json' }, output: result }]
	);
});

test('Throws ExpectedCliError when the project taxonomy is invalid JSON', async () => {
	await withTempDir('module-category-invalid-', (directory) => {
		writeFileSync(join(directory, 'harness.groups.json'), '{invalid');
		let errorName = '';
		try {
			service.load(directory);
		} catch (error) {
			errorName = error instanceof Error ? error.name : 'unknown';
		}
		expect(errorName).toBe('ExpectedCliError');
		recordExampleCases(
			{
				unitId: 'service.module-category',
				symbol: 'ModuleCategoryService.load',
				state: 'throws-expectedclierror-when-the-project-taxonomy-is-invalid',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-when-the-project-taxonomy-is-invalid.json'
			},
			[
				{
					name: 'rejects malformed taxonomy JSON',
					input: { directory, text: '{invalid' },
					error: { name: errorName }
				}
			]
		);
	});
});
