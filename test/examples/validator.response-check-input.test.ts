import type { Recorded } from './validator.response-check-input.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { ResponseCheckInputValidator } from '../../src/validators/verification-evidence/ResponseCheckInputValidator';

const validator = new ResponseCheckInputValidator();

function criterion(id: string, description: string): Record<string, unknown> {
	return { id, description };
}

function rejection(input: unknown): { name: string; message: string } {
	let error: unknown;
	try {
		validator.validateCriteria(input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

function record(state: string, cases: Recorded[]): boolean {
	return recordExampleCases(
		{
			unitId: 'validator.response-check-input',
			symbol: 'validateCriteria',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const rejectedInputs: Array<{ name: string; input: unknown; message: string }> = [
	{
		name: 'non-array object',
		input: { id: 'cites-source', description: 'Cites a source.' },
		message: 'Criteria must be a JSON array.'
	},
	{
		name: 'null element',
		input: [null],
		message: 'Each criterion needs an id and description.'
	},
	{
		name: 'array element',
		input: [['cites-source', 'Cites a source.']],
		message: 'Each criterion needs an id and description.'
	},
	{
		name: 'blank description',
		input: [criterion('word-limit', '   ')],
		message: 'Criterion ids and descriptions must be nonempty strings.'
	},
	{
		name: 'numeric id',
		input: [{ id: 7, description: 'Numbered criterion.' }],
		message: 'Criterion ids and descriptions must be nonempty strings.'
	},
	{
		name: 'duplicate id after trimming',
		input: [
			criterion('rollback-plan', 'Explains rollback.'),
			criterion(' rollback-plan ', 'Again.')
		],
		message: 'Criterion ids must be unique.'
	}
];

test('Accepts an empty criteria array', () => {
	const input: unknown[] = [];
	const output = validator.validateCriteria(input);
	expect(output).toEqual([]);
	record('accepts-an-empty-criteria-array', [{ name: 'empty array', input, output }]);
});

test('Trims ids and descriptions and drops extra properties', () => {
	const single = [criterion('cites-source', 'The response cites at least one source document.')];
	const padded = [
		{ id: ' word-limit ', description: '  The response stays under 200 words. ', weight: 2 },
		{ id: 'rollback-plan', description: 'The response explains how to roll back the change.' }
	];
	const singleOutput = validator.validateCriteria(single);
	const paddedOutput = validator.validateCriteria(padded);
	expect(singleOutput).toEqual(single);
	expect(paddedOutput).toEqual([
		{ id: 'word-limit', description: 'The response stays under 200 words.' },
		{ id: 'rollback-plan', description: 'The response explains how to roll back the change.' }
	]);
	record('trims-ids-and-descriptions-and-drops-extra-properties', [
		{ name: 'one valid criterion', input: single, output: singleOutput },
		{ name: 'padded criteria with an extra property', input: padded, output: paddedOutput }
	]);
});

test('Rejects non-array, malformed, blank and duplicate criteria', () => {
	const cases: Recorded[] = rejectedInputs.map(({ name, input, message }) => {
		const error = rejection(input);
		expect(error.message).toBe(message);
		return { name: `rejects ${name}`, input, error };
	});
	record('rejects-non-array-malformed-blank-and-duplicate-criteria', cases);
});
