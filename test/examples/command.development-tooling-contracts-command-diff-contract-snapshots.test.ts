import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	diffContractSnapshots,
	validateHistoryFields
} from '../../src/commands/development-tooling/contracts-command/diffContractSnapshots';

const unitId = 'command.development-tooling-contracts-command-diff-contract-snapshots';

function renamedSnapshots() {
	const before = [
		{
			id: 'old.command',
			uid: 'stable-1',
			kind: 'command',
			contractPath: 'specification/units/old.json',
			sourcePaths: ['src/old.ts'],
			raw: 'old',
			data: { responsibility: 'old behavior' }
		}
	];
	const after = [
		{
			id: 'old.command',
			kind: 'command',
			contractPath: 'specification/units/old.json',
			sourcePaths: ['src/old.ts'],
			raw: 'retired',
			data: { responsibility: 'old behavior' }
		},
		{
			id: 'new.command',
			uid: 'stable-1',
			kind: 'command',
			contractPath: 'specification/units/new.json',
			sourcePaths: ['src/new.ts'],
			raw: 'new',
			data: { responsibility: 'new behavior' }
		}
	];
	return { before, after };
}

test('Keeps uid renames separate from retired id tombstones', () => {
	const { before, after } = renamedSnapshots();
	const result = diffContractSnapshots(before, after, { limit: 10 });
	validateHistoryFields('description,dependencies');
	expect(result.changes.map(({ id, kind }) => ({ id, kind }))).toEqual([
		{ id: 'new.command', kind: 'moved' },
		{ id: 'old.command', kind: 'added' }
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'diffContractSnapshots',
			state: 'keeps-uid-renames-separate-from-retired-id-tombstones',
			evidence: 'examples-cases',
			file: 'keeps-uid-renames-separate-from-retired-id-tombstones.json'
		},
		[
			{
				name: 'renamed uid with a uid-less old id tombstone',
				input: { before, after, options: { limit: 10 } },
				output: {
					changes: result.changes.map(({ id, kind, previousId }) => ({ id, kind, previousId })),
					total: result.total,
					summary: result.summary
				}
			}
		]
	);
});

test('Throws ExpectedCliError when field category is unsupported', () => {
	const field = 'owner';
	expect(() => validateHistoryFields(field)).toThrow('Unknown contract field filter');
	recordExampleCases(
		{
			unitId,
			symbol: 'validateHistoryFields',
			state: 'throws-expectedclierror-when-field-category-is-unsupported',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-field-category-is-unsupported.json'
		},
		[
			{
				name: 'unsupported field category',
				input: { field },
				error:
					'Unknown contract field filter; choose type, description, examples, errors or dependencies (comma-separated).'
			}
		]
	);
});
