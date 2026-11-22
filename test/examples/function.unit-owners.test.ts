import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { unitOwners } from '../../src/utils/development-tooling/unitOwners';
import type { OwnedSource } from '../../src/utils/development-tooling/unitOwners.types';

test('Lookup returns exact and directory owners in sorted unique o', () => {
	const units = [
		{
			id: 'function.unit-owners',
			source: [
				'src/utils/development-tooling/unitOwners.ts',
				'src/utils/development-tooling/',
				'src/utils/unitOwners.ts'
			]
		},
		{
			id: 'function.development-tooling',
			source: ['src/utils/development-tooling/unitOwners.ts']
		}
	] satisfies OwnedSource[];
	const lookup = unitOwners(units);
	const cases = [
		{
			name: 'declared source matches exact and directory owners once',
			input: { path: 'src/utils/development-tooling/unitOwners.ts', units },
			output: lookup('src/utils/development-tooling/unitOwners.ts')
		},
		{
			name: 'directory declaration owns nested source',
			input: { path: 'src/utils/development-tooling/unitOwners.types.ts', units },
			output: lookup('src/utils/development-tooling/unitOwners.types.ts')
		},
		{
			name: 'exact declaration does not own a sibling',
			input: { path: 'src/utils/other.ts', units },
			output: lookup('src/utils/other.ts')
		},
		{
			name: 'unlisted path has no inferred owner',
			input: { path: 'src/utils/unitOwners.test.ts', units },
			output: lookup('src/utils/unitOwners.test.ts')
		}
	];

	expect(cases.map(({ output }) => output)).toEqual([
		['function.development-tooling', 'function.unit-owners'],
		['function.unit-owners'],
		[],
		[]
	]);
	recordExampleCases(
		{
			unitId: 'function.unit-owners',
			symbol: 'unitOwners',
			state: 'lookup-returns-exact-and-directory-owners-in-sorted-unique-o',
			evidence: 'examples-cases',
			file: 'lookup-returns-exact-and-directory-owners-in-sorted-unique-o.json'
		},
		cases
	);
});
