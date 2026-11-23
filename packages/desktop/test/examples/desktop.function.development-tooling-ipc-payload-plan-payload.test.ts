import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { planPayload } from '../../src/utils/ipc-payload/planPayload';

const COMPONENT = {
	category: 'components',
	title: 'Evidence grid for report units',
	goal: 'Show the latest verification captures for each report unit in one grid so a reviewer can compare them.'
};

const FUNCTION_WITH_CONTRACT = {
	category: 'functions',
	title: 'Plan payload validation',
	goal: 'Validate a plan draft before it reaches local or hosted execution.',
	contract: {
		inputs: [
			{
				name: 'input',
				type: 'Record<string, unknown>',
				description: 'Untrusted createPlan fields.'
			}
		],
		outputs: [{ name: 'planPayload', type: 'PlanDraft' }],
		errors: ['InvalidCategory']
	}
};

function thrownBy(run: () => unknown): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) return error;
		throw error;
	}
	throw new Error('Expected the call to throw.');
}

test('Keeps a valid component plan without adding a contract', () => {
	const draft = planPayload(COMPONENT);

	expect(draft).toEqual({
		category: 'components',
		title: 'Evidence grid for report units',
		goal: COMPONENT.goal
	});
	expect(draft).not.toHaveProperty('contract');

	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-ipc-payload-plan-payload',
			symbol: 'planPayload',
			state: 'keeps-a-valid-component-plan-without-adding-a-contract',
			evidence: 'examples-cases',
			file: 'keeps-a-valid-component-plan-without-adding-a-contract.json'
		},
		[{ name: 'component plan without a contract', input: COMPONENT, output: draft }]
	);
});

test('Keeps a checked proposed contract on a function plan', () => {
	const draft = planPayload(FUNCTION_WITH_CONTRACT);

	expect(draft.category).toBe('functions');
	expect(draft.contract).toEqual(FUNCTION_WITH_CONTRACT.contract);

	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-ipc-payload-plan-payload',
			symbol: 'planPayload',
			state: 'keeps-a-checked-proposed-contract-on-a-function-plan',
			evidence: 'examples-cases',
			file: 'keeps-a-checked-proposed-contract-on-a-function-plan.json'
		},
		[
			{
				name: 'function plan keeps its inputs, outputs and errors',
				input: FUNCTION_WITH_CONTRACT,
				output: { category: draft.category, title: draft.title, contract: draft.contract }
			}
		]
	);
});

test('Rejects an unknown category with Invalid option', () => {
	const input = { ...COMPONENT, category: 'widgets' };
	const thrown = thrownBy(() => planPayload(input));

	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'Invalid option.' });

	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-ipc-payload-plan-payload',
			symbol: 'planPayload',
			state: 'rejects-an-unknown-category-with-invalid-option',
			evidence: 'examples-cases',
			file: 'rejects-an-unknown-category-with-invalid-option.json'
		},
		[
			{
				name: 'reject a category outside the catalog',
				input,
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});

test('Rejects a blank or non-text title with Invalid text field', () => {
	const blank = { ...COMPONENT, title: '   ' };
	const numeric = { ...COMPONENT, title: 42 };
	const blankError = thrownBy(() => planPayload(blank));
	const numericError = thrownBy(() => planPayload(numeric));

	expect(blankError).toMatchObject({ message: 'Invalid text field.' });
	expect(numericError).toMatchObject({ message: 'Invalid text field.' });

	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-ipc-payload-plan-payload',
			symbol: 'planPayload',
			state: 'rejects-a-blank-or-non-text-title-with-invalid-text-field',
			evidence: 'examples-cases',
			file: 'rejects-a-blank-or-non-text-title-with-invalid-text-field.json'
		},
		[
			{
				name: 'reject a whitespace-only title',
				input: blank,
				error: { name: blankError.name, message: blankError.message }
			},
			{
				name: 'reject a numeric title',
				input: numeric,
				error: { name: numericError.name, message: numericError.message }
			}
		]
	);
});

test('Rejects duplicate contract errors with a ZodError', () => {
	const input = {
		...COMPONENT,
		contract: { inputs: [], outputs: [], errors: ['InvalidCategory', 'InvalidCategory'] }
	};
	const thrown = thrownBy(() => planPayload(input));

	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ name: 'ZodError' });

	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-ipc-payload-plan-payload',
			symbol: 'planPayload',
			state: 'rejects-duplicate-contract-errors-with-a-zoderror',
			evidence: 'examples-cases',
			file: 'rejects-duplicate-contract-errors-with-a-zoderror.json'
		},
		[{ name: 'reject duplicate error names in a contract', input, error: { name: thrown.name } }]
	);
});
