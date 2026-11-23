import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { atomicComponents } from '../../src/templates/development-tooling/atomicPreprocess.js';

test('Returns a preprocessor group for supplied options', () => {
	const inputs = [{ aliases: { components: 'src/components' } }, {}];
	const cases = inputs.map((input, index) => {
		const result = atomicComponents(input);
		expect(result).toBeDefined();
		return {
			name: index === 0 ? 'configured component alias' : 'empty options',
			input,
			output: { type: typeof result, keys: Object.keys(result) }
		};
	});

	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-preprocess-d',
			symbol: 'atomicComponents',
			state: 'returns-a-preprocessor-group-for-supplied-options',
			evidence: 'examples-cases',
			file: 'returns-a-preprocessor-group-for-supplied-options.json'
		},
		cases
	);
});
