import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { adapterTypeFiles } from '../../src/templates/development-tooling/adapterTypes';

const operationPattern = /^\t[a-zA-Z]+(<T>)?\(/;

test('Plans the persistence adapter types file', () => {
	const files = adapterTypeFiles();
	const [file] = files;
	const operations = (file?.contents ?? '')
		.split('\n')
		.filter((line) => operationPattern.test(line))
		.map((line) => line.trim());

	expect(files).toHaveLength(1);
	expect(file?.path).toBe('src/models/adapters/types.ts');
	expect(file?.contents).toContain('export interface PersistenceAdapter {');
	expect(operations).toHaveLength(5);
	expect(operations[4]).toBe('delete(table: string, id: number): Promise<boolean>;');

	recordExampleCases(
		{
			unitId: 'template.adapter-types',
			symbol: 'adapterTypeFiles',
			state: 'plans-the-persistence-adapter-types-file',
			evidence: 'examples-cases',
			file: 'plans-the-persistence-adapter-types-file.json'
		},
		[
			{
				name: 'expands the adapter types template into one planned file',
				input: {},
				output: {
					paths: files.map((planned) => planned.path),
					operations
				}
			}
		]
	);
});
