import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { stateRegistries } from '../../src/workflows/development-tooling/guide-units/stateRegistries';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import type { TreeEntry } from '../../src/core/development-tooling/sourceTypes';

test('Reads catalog and required states', async () => {
	await withTempDir('state-registries-', async (directory) => {
		const catalogPath = 'packages/reports/tests/e2e/support/previewCatalog.ts';
		const requiredPath = 'packages/reports/required-states.json';
		const requiredFile = join(directory, requiredPath);
		await mkdir(join(directory, 'packages/reports'), { recursive: true });
		await writeFile(
			requiredFile,
			JSON.stringify({
				entity: 'reports.component.evidence-grid',
				states: ['', 'default', 'compact']
			})
		);
		const entries: TreeEntry[] = [{ path: catalogPath, hash: 'example-hash' }];
		const tree = {
			revision: 'example-revision',
			list: async () => entries,
			read: async (path: string) =>
				path === catalogPath
					? `export const catalog = [{ entity: 'reports.component.evidence-grid', states: ['default', 'compact'] }];`
					: ''
		};
		const result = await stateRegistries(tree, directory, [requiredPath]);
		expect(result).toHaveLength(2);
		expect(result[0].states).toEqual(['default', 'compact']);
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-guide-units-state-registries',
				symbol: 'stateRegistries',
				state: 'reads-catalog-and-required-states',
				evidence: 'examples-cases',
				file: 'reads-catalog-and-required-states.json'
			},
			[
				{
					name: 'extracts literal catalog declarations and required JSON states',
					input: { catalogPath, requiredPath },
					output: result.map(({ entity, where, kind, states }) => ({ entity, where, kind, states }))
				}
			]
		);
	});
});

test('Throws ExpectedCliError for an extra required state file', async () => {
	await withTempDir('state-registries-missing-', async (directory) => {
		const tree = { revision: 'example', list: async () => [], read: async () => '' };
		await expect(
			stateRegistries(tree, directory, ['packages/reports/required-states.json'])
		).rejects.toThrow('Cannot read required-state file');
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-guide-units-state-registries',
				symbol: 'stateRegistries',
				state: 'throws-expectedclierror-for-an-extra-required-state-file',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-for-an-extra-required-state-file.json'
			},
			[
				{
					name: 'reports missing required state file',
					input: { path: 'packages/reports/required-states.json' },
					error: 'Cannot read required-state file "packages/reports/required-states.json".'
				}
			]
		);
	});
});

test('Propagates tree read failures', async () => {
	const tree = {
		revision: 'example',
		list: async () => [{ path: 'packages/reports/required-states.json', hash: 'example' }],
		read: async () => {
			throw new Error('tree read failed');
		}
	};
	await expect(stateRegistries(tree, '/workspace/project')).rejects.toThrow('tree read failed');
	recordExampleCases(
		{
			unitId: 'workflow.development-tooling-guide-units-state-registries',
			symbol: 'stateRegistries',
			state: 'propagates-tree-read-failures',
			evidence: 'examples-cases',
			file: 'propagates-tree-read-failures.json'
		},
		[
			{
				name: 'passes through tree read rejection',
				input: { path: 'packages/reports/required-states.json' },
				error: 'tree read failed'
			}
		]
	);
});
