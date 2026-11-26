import type { HarnessContractItem } from '../../src/models/explorer-ui/Harness.types';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	callableContracts,
	contractFields,
	fieldOf,
	typeLabel
} from '../../src/components/explorer-ui/entity-contract/contractFields';

import { unit as fixtureUnit } from '../explorerFixture';
import { modelDefinition } from '../entityClassFixtures';

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.contract-fields';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
const item = (fields: Record<string, unknown>) => fields as unknown as HarnessContractItem;
const orders = () => fixtureUnit('reports.component.orders', 'component');

/** What a field of one type presents: its source and the exact text of each example. */
function probe(type: string, examples?: unknown[]) {
	const field = fieldOf(item({ name: 'value.sample', type, examples }), orders());
	return { source: field.source, examples: field.examples.map((example) => example.text) };
}

test('Type labels drop only quoted module paths', () => {
	const pairs: Array<[string, string]> = [
		["import('../x/Harness.types').HarnessUnit", 'HarnessUnit'],
		['import("./Item.types").Item[]', 'Item[]'],
		['Item  |\n\tundefined', 'Item | undefined'],
		["import('./only.types')", 'module'],
		['import(./unquoted).Kept', 'import(./unquoted).Kept']
	];
	const outputs = pairs.map(([input]) => typeLabel(input));
	expect(outputs).toEqual(pairs.map(([, output]) => output));
	record(
		'typeLabel',
		'type-labels-drop-only-quoted-modules',
		pairs.map(([input], index) => ({ name: input, input, output: outputs[index] }))
	);
});

test('Declared fields keep their readable name, trimmed description, default and examples', () => {
	const declared = fieldOf(
		item({
			name: 'orders.itemLimit',
			type: 'number',
			description: '  Most rows shown.  ',
			required: false,
			default: 0,
			examples: [5, 0]
		}),
		orders()
	);
	const preview = fixtureUnit('reports.component.preview', 'component', {
		owns: { source: ['packages/reports/src/components/Preview.svelte'], symbols: [] }
	});
	const sample = { name: 'view.Preview', type: 'markup', examples: ['<p>Hi</p>'] };
	const markup = fieldOf(item(sample), preview);
	expect(declared).toMatchObject({
		name: 'Item limit',
		description: 'Most rows shown.',
		required: false,
		default: 0,
		source: 'declared',
		examples: [{ text: '5' }, { text: '0' }]
	});
	expect(markup).toMatchObject({
		name: 'Rendered markup',
		examples: [{ form: 'markup', text: '<p>Hi</p>' }]
	});
	record('fieldOf', 'declared-fields-keep-metadata', [
		{ name: 'orders.itemLimit', input: 'orders.itemLimit', output: declared },
		{ name: 'view.Preview', input: 'view.Preview', output: markup }
	]);
});

test('Plain data gets one illustrative example, and opaque types stay unshown', () => {
	const expected: Array<[string, string]> = [
		['string', 'illustrative'],
		['number', 'illustrative'],
		['string | undefined', 'illustrative'],
		['"open" | "closed"', 'illustrative'],
		['Record<string, number>', 'illustrative'],
		['markup', 'illustrative'],
		['string[][][][]', 'illustrative'],
		['string[][][][][]', 'missing'],
		['PrivateContext', 'missing'],
		['string | PrivateContext', 'missing']
	];
	const outputs = expected.map(([type]) => probe(type));
	expect(outputs.map((output) => output.source)).toEqual(expected.map(([, source]) => source));
	expect(outputs[0].examples).toEqual(['"example"']);
	expect(outputs[5].examples).toEqual(['<p>Example</p>']);
	const empty = probe('string', []);
	expect(empty.source).toBe('illustrative');
	record('fieldOf', 'illustrative-and-missing-examples', [
		...expected.map(([type], index) => ({ name: type, input: type, output: outputs[index] })),
		{ name: 'string with an empty example list', input: 'string', output: empty }
	]);
});

test('Declared falsy examples are kept rather than replaced', () => {
	const output = probe('PrivateContext', [false, 0, null, '', {}]);
	expect(output).toEqual({ source: 'declared', examples: ['false', '0', 'null', '""', '{}'] });
	record('fieldOf', 'declared-falsy-examples-are-kept', [
		{ name: 'false, zero, null, empty text and empty object', input: 'PrivateContext', output }
	]);
});

test('Model fields take requiredness from their optional flag and invent no default', () => {
	const source = 'src/models/OrderInput.types.ts';
	const types = fixtureUnit('app.model.order-input', 'model', {
		owns: { source: [source], symbols: ['OrderInput'] },
		modelDefinitions: [
			{
				...modelDefinition('OrderInput', source),
				fields: [
					{ name: 'id', type: 'string', optional: false },
					{ name: 'note', type: 'string', optional: true }
				],
				methods: [{ name: 'resolve', inputs: [{ name: 'key', type: 'string' }], output: 'number' }]
			},
			modelDefinition('Ledger', 'src/models/Ledger.ts')
		]
	});
	types.contract.inputs = [
		{ name: 'OrderInput.resolve', type: '(key: string): number', required: true }
	];
	const groups = contractFields(types, 'types');
	const fields = groups.flatMap((group) => group.fields);
	const output = fields.map((f) => [
		f.name,
		f.required,
		f.source,
		'default' in f,
		f.examples.length
	]);
	expect(groups.map((group) => group.title)).toEqual(['OrderInput']);
	expect(output).toEqual([
		['id', true, 'missing', false, 0],
		['note?', false, 'missing', false, 0],
		['resolve', true, 'missing', false, 0]
	]);
	record('contractFields', 'model-fields-take-optional-flags', [
		{ name: 'interface fields and callable members', input: source, output }
	]);
});

test('Callable parameters and returns keep their declared names and examples', () => {
	const unit = fixtureUnit('reports.function.slug', 'function', {
		helpers: [
			{
				name: 'slug',
				source: 'src/slug.ts',
				output: 'string',
				inputs: [{ name: 'slug.text', type: 'string' }]
			}
		],
		contract: {
			inputs: [{ name: 'slug.text', type: 'string', required: true, examples: ['Hello World'] }],
			outputs: [{ name: 'slug.value', type: 'string', examples: ['hello-world'] }],
			errors: []
		}
	});
	const [callable] = callableContracts(unit);
	const [parameter] = callable.groups[0].fields;
	const [returned] = callable.groups[1].fields;
	expect(callable.signature).toBe('slug(text: string): string');
	expect(parameter).toMatchObject({ name: 'text', required: true, source: 'declared' });
	expect(parameter.examples[0].text).toBe('"Hello World"');
	expect(returned).toMatchObject({ name: 'value', source: 'declared' });
	const output = { signature: callable.signature, parameter, returned };
	record('callableContracts', 'callable-parameters-and-returns-keep-names', [
		{ name: 'slug', input: 'slug', output }
	]);
});

test('Void callables say no value is returned and declare no parameters', () => {
	const unit = fixtureUnit('reports.function.log-line', 'function', {
		helpers: [{ name: 'logLine', source: 'src/log.ts', output: 'void', inputs: [] }],
		contract: { inputs: [], outputs: [], errors: [] }
	});
	const [callable] = callableContracts(unit);
	const [returned] = callable.groups[1].fields;
	expect(callable.signature).toBe('logLine(): void');
	expect(callable.groups[0].fields).toEqual([]);
	expect(returned).toEqual({
		name: 'returnValue',
		type: 'void',
		source: 'missing',
		examples: [],
		description: 'This function returns no value.'
	});
	record('callableContracts', 'void-callables-say-no-value', [
		{ name: 'logLine', input: 'logLine', output: returned }
	]);
});

test('Serializer failures reach the caller uncaught', () => {
	let deep: Record<string, unknown> = {};
	for (let index = 0; index < 20_000; index++) deep = { nested: deep };
	const cyclic: Record<string, unknown> = {};
	cyclic.self = cyclic;
	expect(() => probe('number', [1n])).toThrow(TypeError);
	expect(() => probe('object', [cyclic])).toThrow(TypeError);
	expect(() => probe('object', [deep])).toThrow(RangeError);
	record('fieldOf', 'serializer-errors-reach-the-caller', [
		{ name: 'bigint example', input: 'number example 1n', error: 'TypeError' },
		{ name: 'circular example', input: 'object example with a cycle', error: 'TypeError' },
		{ name: 'deep example', input: 'object example 20000 levels deep', error: 'RangeError' }
	]);
});
