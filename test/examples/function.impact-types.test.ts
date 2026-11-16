import { test } from 'vitest';
import type { ChangedFile } from '../../src/core/development-tooling/impactTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Changed files retain classifications and optional owners', () => {
	const ownedSourceChange = {
		path: 'src/features/report.ts',
		status: 'modified',
		classification: 'source',
		unit: 'function.report'
	} satisfies ChangedFile;
	const unownedTestChange = {
		path: 'test/features/report.test.ts',
		status: 'added',
		classification: 'test'
	} satisfies ChangedFile;

	expect([ownedSourceChange, unownedTestChange]).toEqual([
		{
			path: 'src/features/report.ts',
			status: 'modified',
			classification: 'source',
			unit: 'function.report'
		},
		{
			path: 'test/features/report.test.ts',
			status: 'added',
			classification: 'test'
		}
	]);
	recordExampleCases(
		{
			unitId: 'function.impact-types',
			symbol: 'ChangedFile',
			state: 'changed-files-retain-classifications-and-optional-owners',
			evidence: 'examples-cases',
			file: 'changed-files-retain-classifications-and-optional-owners.json'
		},
		[
			{
				name: 'owned source file was modified',
				input: { path: ownedSourceChange.path, status: ownedSourceChange.status },
				output: ownedSourceChange
			},
			{
				name: 'unowned test file was added',
				input: { path: unownedTestChange.path, status: unownedTestChange.status },
				output: unownedTestChange
			}
		]
	);
});
