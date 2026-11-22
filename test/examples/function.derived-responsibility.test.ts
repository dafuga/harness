import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { derivedResponsibility } from '../../src/workflows/development-tooling/load-units/unit-index-service/derivedResponsibility';

test('Derives purpose by exact kind and preserves title', () => {
	const examples = [
		{
			name: 'known kind selects its purpose phrase',
			input: { kind: 'function', title: 'Fallback unit responsibility' },
			output: 'Owns the Fallback unit responsibility shared function.'
		},
		{
			name: 'unknown case-sensitive kind uses the kind fallback',
			input: { kind: 'Function', title: 'Unit index' },
			output: 'Owns the Unit index Function unit.'
		},
		{
			name: 'empty title remains unchanged',
			input: { kind: 'service', title: '' },
			output: 'Owns the  service workflow.'
		}
	];
	const results = examples.map(({ input }) => derivedResponsibility(input.kind, input.title));
	expect(results).toEqual(examples.map(({ output }) => output));
	recordExampleCases(
		{
			unitId: 'function.derived-responsibility',
			symbol: 'derivedResponsibility',
			state: 'derives-purpose-by-exact-kind-and-preserves-title',
			evidence: 'examples-cases',
			file: 'derives-purpose-by-exact-kind-and-preserves-title.json'
		},
		examples
	);
});
