import { test } from 'vitest';
import { atomicComponentRules } from '../../src/templates/development-tooling/atomicGuidance';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Returns atomic UI composition guidance', () => {
	const output = atomicComponentRules();
	expect(output).toContain('## Atomic UI composition');
	expect(output).toContain('atomicComponents()');
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-guidance',
			symbol: 'atomicComponentRules',
			state: 'returns-atomic-ui-composition-guidance',
			evidence: 'examples-cases',
			file: 'returns-atomic-ui-composition-guidance.json'
		},
		[
			{
				name: 'returns the shared atomic composition headings and guidance',
				input: {},
				output: {
					heading: output.split('\n')[0],
					composition: output.split('\n').find((line) => line.startsWith('- Build Svelte UI')),
					nativeAtoms: output.split('\n').find((line) => line.startsWith('- Native elements belong')),
					verification: output.split('\n').find((line) => line.startsWith('- Run `harness audit`'))
				}
			}
		]
	);
});
