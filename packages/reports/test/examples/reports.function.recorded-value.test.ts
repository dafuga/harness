import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { read, recordedValue } from '../../src/utils/shared-primitives/recordedValue';

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.recorded-value';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
const truncatedNotice = { kind: 'notice', text: 'Open Full recorded values to see more.' };

test('Scalars keep their types and absent or empty values say so', () => {
	const pairs: Array<[string, unknown, unknown]> = [
		['text', 'passed', { kind: 'scalar', type: 'Text', text: 'passed' }],
		['fraction', 42.5, { kind: 'scalar', type: 'Number', text: '42.5' }],
		['flag', true, { kind: 'scalar', type: 'Boolean', text: 'true' }],
		['no value', null, { kind: 'scalar', type: 'Null', text: 'null' }],
		['absent value', undefined, { kind: 'notice', text: 'Not recorded' }],
		['empty text', '', { kind: 'notice', text: 'Empty text' }],
		['big integer', 12n, { kind: 'scalar', type: 'bigint', text: '12' }],
		['symbol', Symbol('tag'), { kind: 'scalar', type: 'symbol', text: 'Symbol(tag)' }]
	];
	const outputs = pairs.map(([, input]) => recordedValue(input));
	expect(outputs).toEqual(pairs.map(([, , expected]) => expected));
	record(
		'recordedValue',
		'scalars-and-missing-values-keep-types',
		pairs.map(([name], index) => ({ name, input: String(name), output: outputs[index] }))
	);
});

test('Text over 240 characters is cut and marked shortened', () => {
	const exact = 'x'.repeat(240);
	const longer = 'y'.repeat(241);
	const long = 'z'.repeat(300);
	const outputs = [recordedValue(exact), recordedValue(longer), recordedValue(long)];
	expect(outputs[0]).toEqual({ kind: 'scalar', type: 'Text', text: exact });
	expect(outputs[1]).toEqual({
		kind: 'scalar',
		type: 'Text',
		text: 'y'.repeat(240),
		shortened: true
	});
	expect(outputs[2]).toMatchObject({ kind: 'scalar', text: 'z'.repeat(240), shortened: true });
	record('recordedValue', 'long-text-is-cut-and-marked', [
		{ name: '240 characters', input: 'x 240', output: outputs[0] },
		{ name: '241 characters', input: 'y 241', output: outputs[1] },
		{ name: '300 characters', input: 'z 300', output: outputs[2] }
	]);
});

test('Collections show twelve entries and become tables only for flat scalar rows', () => {
	const wide = Object.fromEntries(Array.from({ length: 14 }, (_, index) => [`k${index}`, index]));
	const rows = Array.from({ length: 15 }, (_, id) => ({ id, state: 'ok' }));
	const nineKeys = Array.from({ length: 9 }, (_, index) => ({ [`key${index}`]: index }));
	const objectOutput = recordedValue(wide);
	const tableOutput = recordedValue(rows);
	const listOutput = recordedValue(nineKeys);
	expect(objectOutput).toMatchObject({ kind: 'fields', remaining: 2 });
	expect((objectOutput as { fields: unknown[] }).fields).toHaveLength(12);
	expect(tableOutput).toMatchObject({ kind: 'table', columns: ['id', 'state'], remaining: 3 });
	expect((tableOutput as { rows: unknown[] }).rows).toHaveLength(12);
	expect(listOutput).toMatchObject({ kind: 'list', remaining: 0 });
	expect((listOutput as { items: unknown[] }).items).toHaveLength(9);
	record('recordedValue', 'collections-show-first-twelve-and-table-rule', [
		{ name: 'fourteen fields', input: 'object with 14 keys', output: objectOutput },
		{ name: 'fifteen flat rows', input: 'array of 15 objects', output: tableOutput },
		{ name: 'nine distinct keys', input: 'nine single-key objects', output: listOutput }
	]);
});

test('Mixed, nested, empty and sparse collections fall back or keep their gaps', () => {
	const twelvePlusText = [...Array.from({ length: 12 }, (_, id) => ({ id })), 'extra'];
	const outputs = {
		mixed: recordedValue([{ a: 1 }, 'x']),
		nested: recordedValue([{ tags: [1] }]),
		emptyObjects: recordedValue([{}, {}]),
		sparse: recordedValue([{ a: 1, b: 2 }, { a: 3 }]),
		trailingText: recordedValue(twelvePlusText),
		emptyList: recordedValue([]),
		emptyObject: recordedValue({})
	};
	expect(outputs.mixed).toMatchObject({ kind: 'list' });
	expect(outputs.nested).toMatchObject({ kind: 'list' });
	expect(outputs.emptyObjects).toEqual({
		kind: 'list',
		items: [
			{ kind: 'notice', text: 'Empty object' },
			{ kind: 'notice', text: 'Empty object' }
		],
		remaining: 0
	});
	expect(outputs.sparse).toMatchObject({
		kind: 'table',
		rows: [
			[
				{ kind: 'scalar', text: '1' },
				{ kind: 'scalar', text: '2' }
			],
			[
				{ kind: 'scalar', text: '3' },
				{ kind: 'notice', text: 'Not recorded' }
			]
		]
	});
	expect(outputs.trailingText).toMatchObject({ kind: 'table', remaining: 1 });
	expect(outputs.emptyList).toEqual({ kind: 'notice', text: 'Empty list' });
	expect(outputs.emptyObject).toEqual({ kind: 'notice', text: 'Empty object' });
	record(
		'recordedValue',
		'mixed-and-sparse-collections-fall-back',
		Object.entries(outputs).map(([name, output]) => ({ name, input: name, output }))
	);
});

test('Nesting stops at four levels while scalars at that depth still show', () => {
	const beyond = recordedValue({ a: { b: { c: { d: { e: 1 } } } } });
	const atLimit = recordedValue({ a: { b: { c: { d: 'x' } } } });
	expect(beyond).toMatchObject({
		fields: [
			{
				name: 'a',
				node: {
					fields: [
						{
							name: 'b',
							node: {
								fields: [{ name: 'c', node: { fields: [{ name: 'd', node: truncatedNotice }] } }]
							}
						}
					]
				}
			}
		]
	});
	expect(JSON.stringify(atLimit)).toContain('"text":"x"');
	record('recordedValue', 'nesting-stops-at-depth-four', [
		{ name: 'object at depth four', input: { a: { b: { c: { d: { e: 1 } } } } }, output: beyond },
		{ name: 'scalar at depth four', input: { a: { b: { c: { d: 'x' } } } }, output: atLimit }
	]);
});

test('The 120-value budget ends in notices rather than errors', () => {
	const groups = Object.fromEntries(
		Array.from({ length: 12 }, (_, group) => [
			`g${group}`,
			Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`s${index}`, `v${index}`]))
		])
	);
	const output = recordedValue(groups) as {
		fields: Array<{ name: string; node: { kind: string; fields?: Array<{ node: unknown }> } }>;
	};
	expect(output.fields).toHaveLength(12);
	const shownFirstGroups = output.fields.slice(0, 9).every((field) => field.node.kind === 'fields');
	expect(shownFirstGroups).toBe(true);
	expect(output.fields[9].node.fields?.[0].node).toMatchObject({ kind: 'scalar', text: 'v0' });
	expect(output.fields[9].node.fields?.[1].node).toEqual(truncatedNotice);
	expect(output.fields[10].node).toEqual(truncatedNotice);
	expect(output.fields[11].node).toEqual(truncatedNotice);
	record('recordedValue', 'budget-ends-in-notices', [
		{ name: 'twelve groups of twelve values', input: 'g0-g11 with s0-s11', output }
	]);
});

test('Deep-frozen input is only read and presents without error', () => {
	const value = Object.freeze({
		rows: Object.freeze([Object.freeze({ id: 1, tags: Object.freeze(['a']) })]),
		note: 'kept'
	});
	const before = JSON.stringify(value);
	const output = recordedValue(value);
	expect(JSON.stringify(value)).toBe(before);
	expect(output).toMatchObject({ kind: 'fields', remaining: 0 });
	record('recordedValue', 'input-is-never-rewritten', [
		{ name: 'frozen nested rows', input: before, output }
	]);
});

test('Position reads follow the given depth and budget', () => {
	const budgets = [{ left: 1 }, { left: 0 }, { left: 5 }, { left: 5 }, { left: 3 }];
	const calls = [
		{ name: 'number with budget left', input: 7, args: [0, budgets[0]] as const },
		{ name: 'object with no budget', input: { a: 1 }, args: [0, budgets[1]] as const },
		{ name: 'array at depth four', input: [1], args: [4, budgets[2]] as const },
		{ name: 'null at depth four', input: null, args: [4, budgets[3]] as const },
		{ name: 'absent value', input: undefined, args: [0, budgets[4]] as const }
	];
	const outputs = calls.map(({ input, args }) => read(input, args[0], args[1]));
	expect(outputs).toEqual([
		{ kind: 'scalar', type: 'Number', text: '7' },
		truncatedNotice,
		truncatedNotice,
		{ kind: 'scalar', type: 'Null', text: 'null' },
		{ kind: 'notice', text: 'Not recorded' }
	]);
	expect(budgets.map((budget) => budget.left)).toEqual([0, -1, 4, 4, 2]);
	record(
		'read',
		'position-reads-follow-depth-and-budget',
		calls.map(({ name, input }, index) => ({ name, input, output: outputs[index] }))
	);
});

test('Getter failures reach the caller uncaught', () => {
	const throwing = {
		get broken(): unknown {
			throw new Error('getter failed');
		}
	};
	expect(() => recordedValue(throwing)).toThrow('getter failed');
	record('recordedValue', 'getter-errors-reach-the-caller', [
		{ name: 'getter that throws', input: 'object with a throwing getter', error: 'Error' }
	]);
});
