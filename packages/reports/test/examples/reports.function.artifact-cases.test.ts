import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { artifactCases, caseForm } from '../../src/utils/explorer-ui/artifactCases';
import type { Cases } from './reports.function.artifact-cases.test.types';

const unitId = 'reports.function.artifact-cases';
const gapWhy = 'Its cases are not in the recorded form.';
const noneWhy = 'This result records no input and output.';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol: 'artifactCases', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

/** A recorded-call document of this unit, with the given calls and any overridden fields. */
const invocations = (calls: unknown[], overrides: Record<string, unknown> = {}) => ({
	schemaVersion: 1,
	kind: caseForm.kind,
	unitId,
	symbol: 'artifactCases',
	cases: calls,
	...overrides
});

const malformed = { kind: 'gap', why: gapWhy };
const sixtyFour = Array.from({ length: caseForm.most }, (_, index) => ({
	name: `call ${index}`,
	input: index,
	output: index * 2
}));
const sixtyFive = [...sixtyFour, { name: 'extra', input: 0, output: 0 }];

test('The recorded-call format sets version 1, the function-invocations kind, 64 calls and 160-character names', () => {
	expect(caseForm).toEqual({ version: 1, kind: 'function-invocations', most: 64, name: 160 });
	record('case-form-sets-the-recorded-format', [
		{ name: 'format constants', input: 'caseForm', output: caseForm }
	]);
});

test('Valid recorded calls give one row per call, marking thrown calls as failed', () => {
	const document = invocations([
		{ name: 'Reads a value', input: { key: 'a' }, output: 'alpha' },
		{ name: 'Throws on missing', input: { key: 'z' }, error: 'RangeError' }
	]);
	const expected = {
		kind: 'cases',
		source: 'invocations',
		symbol: 'artifactCases',
		cases: [
			{ name: 'Reads a value', input: { key: 'a' }, output: 'alpha', failed: false },
			{ name: 'Throws on missing', input: { key: 'z' }, error: 'RangeError', failed: true }
		]
	};
	expect(artifactCases(document)).toEqual(expected);
	expect(artifactCases(document, unitId)).toEqual(expected);
	record('recorded-calls-give-one-row-per-call', [
		{ name: 'no unit filter', input: { document }, output: artifactCases(document) },
		{
			name: 'matching unit filter',
			input: { document, unit: unitId },
			output: artifactCases(document, unitId)
		}
	]);
});

test('A recorded document of another unit is a gap, and omitting the unit keeps valid calls', () => {
	const document = invocations([{ name: 'Reads a value', input: 1, output: 2 }]);
	const other = artifactCases(document, 'reports.component.other');
	expect(other).toEqual({
		kind: 'gap',
		why: 'Its cases are of another unit, reports.function.artifact-cases.'
	});
	expect(artifactCases(document)).toMatchObject({ kind: 'cases', source: 'invocations' });
	const observation = { input: { a: 1 }, output: 2 };
	expect(artifactCases(observation, 'reports.component.other')).toMatchObject({
		kind: 'cases',
		source: 'observation'
	});
	record('other-unit-is-a-gap-and-no-filter-keeps-rows', [
		{
			name: 'another unit is a gap',
			input: { document, unit: 'reports.component.other' },
			output: other
		},
		{ name: 'no unit keeps the calls', input: { document }, output: artifactCases(document) },
		{
			name: 'legacy observation is not filtered',
			input: { document: observation, unit: 'reports.component.other' },
			output: artifactCases(observation, 'reports.component.other')
		}
	]);
});

test('A recorded document outside the form limits or shape is a gap, and one bad call spoils the list', () => {
	const bad: Array<[string, unknown]> = [
		['schema version 2', invocations(sixtyFour.slice(0, 1), { schemaVersion: 2 })],
		['empty symbol', invocations(sixtyFour.slice(0, 1), { symbol: '' })],
		[
			'unit name of 201 characters',
			invocations(sixtyFour.slice(0, 1), { unitId: 'u'.repeat(201) })
		],
		['no calls', invocations([])],
		['65 calls', invocations(sixtyFive)],
		['name of 161 characters', invocations([{ name: 'n'.repeat(161), input: 1, output: 1 }])],
		[
			'call with output and error',
			invocations([{ name: 'both', input: 1, output: 2, error: 'x' }])
		],
		['call with neither output nor error', invocations([{ name: 'neither', input: 1 }])],
		['call without input', invocations([{ name: 'no input', output: 1 }])],
		[
			'one bad call among good calls',
			invocations([
				{ name: 'good', input: 1, output: 1 },
				{ name: 'bad', output: 1 }
			])
		]
	];
	for (const [, document] of bad) expect(artifactCases(document)).toEqual(malformed);
	const limits = artifactCases(invocations(sixtyFour));
	expect(limits).toMatchObject({ kind: 'cases', cases: expect.any(Array) });
	expect(limits.kind === 'cases' ? limits.cases.length : -1).toBe(caseForm.most);
	record('malformed-recorded-documents-are-gaps', [
		...bad.map(([name, input]) => ({ name, input, output: artifactCases(input) })),
		{
			name: '64 calls are accepted',
			input: { calls: caseForm.most },
			output: { count: limits.kind === 'cases' ? limits.cases.length : -1 }
		}
	]);
});

test('Zero, false, null and empty values are recorded rows rather than dropped', () => {
	const document = invocations([
		{ name: 'Zero count', input: [], output: 0 },
		{ name: 'False flag', input: {}, output: false },
		{ name: 'Null result', input: null, output: null },
		{ name: 'Empty list', input: 'none', output: [] }
	]);
	const read = artifactCases(document);
	expect(read).toMatchObject({
		cases: [
			{ output: 0, failed: false },
			{ output: false, failed: false },
			{ input: null, output: null, failed: false },
			{ output: [], failed: false }
		]
	});
	const legacy = artifactCases({ request: null, response: [] });
	expect(legacy).toEqual({
		kind: 'cases',
		source: 'observation',
		symbol: null,
		cases: [{ name: 'Test observation', input: null, output: [], failed: false }]
	});
	record('falsy-and-null-values-are-kept', [
		{ name: 'recorded falsy outputs and nulls', input: { document }, output: read },
		{
			name: 'legacy null request and empty response',
			input: { request: null, response: [] },
			output: legacy
		}
	]);
});

test('A legacy observation takes its input and output from the first alias present and gaps without both', () => {
	const first = artifactCases({
		input: 'first',
		inputs: 'second',
		request: 'third',
		output: 'o1',
		outputs: 'o2',
		response: 'o3'
	});
	const request = artifactCases({ request: 'r', response: 's' });
	const lists = artifactCases({ inputs: ['a'], outputs: [] });
	const noOutput = artifactCases({ input: 1 });
	const noInput = artifactCases({ response: 1 });
	expect(first).toMatchObject({ cases: [{ input: 'first', output: 'o1' }] });
	expect(request).toMatchObject({ cases: [{ input: 'r', output: 's' }] });
	expect(lists).toMatchObject({ cases: [{ input: ['a'], output: [] }] });
	expect(noOutput).toEqual({ kind: 'gap', why: noneWhy });
	expect(noInput).toEqual({ kind: 'gap', why: noneWhy });
	record('legacy-observation-uses-first-present-alias', [
		{ name: 'first alias in each group wins', input: 'all six names', output: first },
		{
			name: 'request and response aliases',
			input: { request: 'r', response: 's' },
			output: request
		},
		{ name: 'list values are kept', input: { inputs: ['a'], outputs: [] }, output: lists },
		{ name: 'input without output is a gap', input: { input: 1 }, output: noOutput },
		{ name: 'output without input is a gap', input: { response: 1 }, output: noInput }
	]);
});

test('Null, primitive and array documents give the no-input-and-output gap', () => {
	const inputs: unknown[] = [null, undefined, 'text', 42, ['input', 'output']];
	const outputs = inputs.map((input) => artifactCases(input));
	expect(outputs).toEqual(inputs.map(() => ({ kind: 'gap', why: noneWhy })));
	record(
		'non-object-documents-give-no-cases',
		inputs.map((input, index) => ({
			name: `document ${index}`,
			input,
			output: outputs[index]
		}))
	);
});
