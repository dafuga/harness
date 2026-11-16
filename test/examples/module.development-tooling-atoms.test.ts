import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { atomicComponents } from '../../src/lib/development-tooling/atoms';

test('Creates the atoms preprocessor', () => {
	const options = { aliases: { 'x-button': 'Button' } };
	const preprocessor = atomicComponents(options);
	const output = {
		type: typeof preprocessor,
		name: preprocessor.name,
		keys: Object.keys(preprocessor).sort()
	};

	expect(preprocessor).toBeDefined();
	recordExampleCases(
		{
			unitId: 'module.development-tooling-atoms',
			symbol: 'atomicComponents',
			state: 'creates-the-atoms-preprocessor',
			evidence: 'examples-cases',
			file: 'creates-the-atoms-preprocessor.json'
		},
		[{ name: 'forwards aliases to the preprocessor factory', input: options, output }]
	);
});
