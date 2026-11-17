import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { ContractField } from '../../src/models/development-tooling/DesktopEntity.types';

test('accepts a contract field with documented metadata', () => {
	const field: ContractField = {
		name: 'version',
		type: 'string',
		required: true,
		description: 'The selected entity version.'
	};

	expect(field).toEqual({
		name: 'version',
		type: 'string',
		required: true,
		description: 'The selected entity version.'
	});

	recordExampleCases(
		{
			unitId: 'desktop.model.development-tooling-desktop-entity-types',
			symbol: 'ContractField',
			state: 'accepts-a-contract-field-with-documented-metadata',
			evidence: 'examples-cases',
			file: 'accepts-a-contract-field-with-documented-metadata.json'
		},
		[
			{
				name: 'required version field',
				input: { name: 'version', type: 'string', required: true },
				output: field
			}
		]
	);
});
