import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { atomicRuntimeSources } from '../../src/templates/development-tooling/atomicRuntimeSources';

test('Provides the three generated atomic runtime sources', () => {
	const names = Object.keys(atomicRuntimeSources).sort();
	const output = {
		'atomicComponents.js': atomicRuntimeSources['atomicComponents.js'].split('\n').slice(0, 2),
		'atomicSyntax.js': atomicRuntimeSources['atomicSyntax.js'].split('\n').slice(0, 2),
		'htmlElements.js': atomicRuntimeSources['htmlElements.js'].split('\n').slice(0, 2)
	};
	expect(names).toEqual(['atomicComponents.js', 'atomicSyntax.js', 'htmlElements.js']);
	expect(Object.values(atomicRuntimeSources).every((source) => typeof source === 'string')).toBe(
		true
	);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-runtime-sources',
			symbol: 'atomicRuntimeSources',
			state: 'provides-the-three-generated-atomic-runtime-sources',
			evidence: 'examples-cases',
			file: 'provides-the-three-generated-atomic-runtime-sources.json'
		},
		[
			{
				name: 'template import exposes the generated runtime filenames and source headers',
				input: {},
				output
			}
		]
	);
});
