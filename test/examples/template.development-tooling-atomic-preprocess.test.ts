import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { atomicComponents } from '../../src/templates/development-tooling/atomicPreprocess';

test('Skips markup without atom syntax', () => {
	const filename = '/workspace/project/src/components/Card.svelte';
	const content = '<p>Plain component markup</p>';
	const markup = atomicComponents().markup;
	expect(markup).toBeDefined();
	const result = markup?.({ content, filename });

	expect(result).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-preprocess',
			symbol: 'atomicComponents',
			state: 'skips-markup-without-atom-syntax',
			evidence: 'examples-cases',
			file: 'skips-markup-without-atom-syntax.json'
		},
		[
			{
				name: 'ordinary markup is left for the next preprocessor',
				input: { filename, content },
				output: null
			}
		]
	);
});
