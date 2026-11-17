import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	sameSelection,
	validateSessionId
} from '../../src/core/development-tooling/pickerModelTypes';
import { InvalidSessionIdError } from '../../src/core/development-tooling/pickerModelTypes.types';
import type { ProviderSelection } from '../../src/core/development-tooling/pickerModelTypes.types';

test('Selection equality and session IDs are exact', () => {
	const first: ProviderSelection = {
		provider: 'openai',
		model: 'model-1',
		effort: 'effort-1'
	};
	const equal: ProviderSelection = { ...first };
	const differentEffort: ProviderSelection = { ...first, effort: 'effort-2' };
	const equalResult = sameSelection(first, equal);
	const differentResult = sameSelection(first, differentEffort);
	expect([equalResult, differentResult]).toEqual([true, false]);
	recordExampleCases(
		{
			unitId: 'function.picker-model-types',
			symbol: 'sameSelection',
			state: 'selection-equality-and-session-ids-are-exact',
			evidence: 'examples-cases',
			file: 'selection-equality-and-session-ids-are-exact.json'
		},
		[
			{ name: 'identical provider, model and effort', input: { a: first, b: equal }, output: equalResult },
			{ name: 'different effort', input: { a: first, b: differentEffort }, output: differentResult }
		]
	);
	const accepted = ['codex-session-01', 'a7F3_x9'].map((value) => ({
		value,
		output: validateSessionId(value)
	}));
	let error: unknown;
	try {
		validateSessionId('bad session');
	} catch (caught) {
		error = caught;
	}
	expect(accepted.map(({ output }) => output)).toEqual(['codex-session-01', 'a7F3_x9']);
	expect(error).toBeInstanceOf(InvalidSessionIdError);
	expect((error as Error).message).toBe('A valid explicit Codex session ID is required.');
	recordExampleCases(
		{
			unitId: 'function.picker-model-types',
			symbol: 'validateSessionId',
			state: 'selection-equality-and-session-ids-are-exact',
			evidence: 'examples-cases',
			file: 'selection-equality-and-session-ids-are-exact.json'
		},
		[
			...accepted.map(({ value, output }) => ({ name: `accepts ${value}`, input: value, output })),
			{
				name: 'rejects whitespace',
				input: 'bad session',
				error: { name: 'InvalidSessionIdError', message: (error as Error).message }
			}
		]
	);
});
