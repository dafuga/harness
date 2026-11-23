import { test } from 'vitest';
import { compositionSchema } from '../../src/core/development-tooling/composition';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Validates composition metadata and rejects invalid values', () => {
	const validInput = {
		level: 'molecule',
		element: '  Button  ',
		uses: ['  Pill  ', 'StatusBadge']
	};
	const valid = compositionSchema.safeParse(validInput);
	const invalidLevel = compositionSchema.safeParse({ level: 'widget' });
	const emptyDependency = compositionSchema.safeParse({ level: 'atom', uses: ['  '] });
	const unknownField = compositionSchema.safeParse({ level: 'page', category: 'forms' });
	const output = valid.success ? valid.data : null;
	const state = 'validates-composition-metadata-and-rejects-invalid-values';

	expect(output).toEqual({ level: 'molecule', element: 'Button', uses: ['Pill', 'StatusBadge'] });
	expect([invalidLevel.success, emptyDependency.success, unknownField.success]).toEqual([
		false,
		false,
		false
	]);
	recordExampleCases(
		{
			unitId: 'function.development-tooling-composition',
			symbol: 'compositionSchema',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{ name: 'trims native element and direct runtime dependencies', input: validInput, output },
			{
				name: 'rejects an unsupported composition level',
				input: { level: 'widget' },
				output: { success: false }
			},
			{
				name: 'rejects an empty dependency name',
				input: { level: 'atom', uses: ['  '] },
				output: { success: false }
			},
			{
				name: 'rejects undeclared metadata fields',
				input: { level: 'page', category: 'forms' },
				output: { success: false }
			}
		]
	);
});
