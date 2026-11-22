import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { serviceContract, modelContract } from '../../src/components/explorer-ui/entity-contract/serviceMethods';

type Unit = Parameters<typeof serviceContract>[0];
type Result = ReturnType<typeof serviceContract>;
type Fields = Pick<Unit, 'owns' | 'contract'> & Partial<Pick<Unit, 'serviceClasses' | 'modelDefinitions'>>;
type Call = { symbol: string; input: unknown; run: () => unknown };

const ID = 'reports.component.explorer-ui-entity-contract-service-methods';
const STORE_SOURCE = 'packages/reports/src/components/report-store/ReportStore.ts';
const MODEL_SOURCE = 'packages/reports/src/models/reports/ReportRecord.ts';
const STORE_PARAM = 'ReportStore.create.record';
const MODEL_PARAM = 'ReportRecord.find.id';

function runtimeOf(source: string): Unit['runtime'] {
	return { kind: 'module', targets: [{ kind: 'module', entry: source }] };
}

function unitOf(id: string, title: string, source: string, fields: Fields): Unit {
	return {
		id,
		kind: 'function',
		status: 'active',
		title,
		responsibility: `Example ${title} unit.`,
		dependencies: [],
		scenarios: [],
		runtime: runtimeOf(source),
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		version: 'a41f0c9e7d2b5863',
		...fields
	};
}

const storeUnit = unitOf('reports.component.report-store', 'ReportStore', STORE_SOURCE, {
	owns: { source: [STORE_SOURCE], symbols: ['ReportStore.create', 'ReportStore.read'] },
	contract: {
		inputs: [{ name: STORE_PARAM, type: 'ReportRecordInput', required: true }],
		outputs: [
			{ name: 'ReportStore.create.returnValue', type: 'Promise<ReportRecord>' },
			{ name: 'ReportStore.read.returnValue', type: 'Promise<ReportRecord | null>' }
		],
		errors: [
			{ name: 'ReportStore.create', type: 'DuplicateRecordError' },
			{ name: 'ReportStore.close', type: 'StoreClosedError' }
		]
	},
	serviceClasses: [
		{
			source: STORE_SOURCE,
			name: 'ReportStore',
			methods: ['create', 'read'],
			constructedBy: [],
			consumers: []
		}
	]
});

const modelUnit = unitOf('reports.model.report-record', 'ReportRecord', MODEL_SOURCE, {
	owns: {
		source: [MODEL_SOURCE],
		symbols: ['ReportRecord', 'ReportRecord.create', 'ReportRecord.find', 'ReportRecord.delete']
	},
	contract: {
		inputs: [
			{
				name: 'ReportRecord.create.input',
				type: 'ReportRecordInput',
				required: true,
				description: 'The fields of the record to store.'
			},
			{ name: MODEL_PARAM, type: 'string', required: true }
		],
		outputs: [],
		errors: [
			{
				name: 'ReportRecord.find',
				type: 'RecordMissingError',
				description: 'Thrown when no record has the given id.'
			}
		]
	},
	modelDefinitions: [
		{
			name: 'ReportRecord',
			kind: 'class',
			source: MODEL_SOURCE,
			fields: [
				{ name: 'id', type: 'string', optional: false },
				{ name: 'title', type: 'string', optional: false }
			],
			methods: [
				{ name: 'constructor', inputs: [{ name: 'input', type: 'ReportRecordInput' }], output: 'ReportRecord' },
				{ name: 'create', inputs: [{ name: 'input', type: 'ReportRecordInput' }], output: 'Promise<ReportRecord>' },
				{ name: 'find', inputs: [{ name: 'id', type: 'string' }], output: 'Promise<ReportRecord | null>' },
				{ name: 'delete', inputs: [{ name: 'id', type: 'string' }], output: 'Promise<boolean>' }
			]
		}
	]
});

const emptyUnit = unitOf('reports.component.empty', 'Empty', STORE_SOURCE, {
	owns: { source: [STORE_SOURCE], symbols: [] },
	contract: { inputs: [], outputs: [], errors: [] }
});

/** A unit whose named parameter declares one example value, as its source declares it. */
function withExample(unit: Unit, name: string, example: unknown): Unit {
	const inputs = unit.contract.inputs.map((item) =>
		item.name === name ? { ...item, examples: [example] } : item
	);
	return { ...unit, contract: { ...unit.contract, inputs } };
}

/** The error a call throws, or undefined when it returns. */
function thrownBy(run: () => unknown): unknown {
	try {
		run();
		return undefined;
	} catch (caught) {
		return caught;
	}
}

function record(state: string, symbol: string, cases: Parameters<typeof recordExampleCases>[1]): void {
	recordExampleCases({ unitId: ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` }, cases);
}

/** Runs each call expected to throw and records every thrown error as cases of one state. */
function recordThrows(state: string, calls: Call[]): unknown[] {
	const errors = calls.map((call) => thrownBy(call.run));
	const cases = calls.map((call, index) => ({
		name: `${call.symbol} with its declared example`,
		input: call.input,
		error: String(errors[index])
	}));
	record(state, 'serviceContract', cases);
	return errors;
}

/** A nested value deep enough to overflow the JSON serializer's call stack. */
const deep = (depth: number): unknown =>
	Array.from({ length: depth }).reduce<unknown>((value) => ({ child: value }), 'leaf');

const cyclic: Record<string, unknown> = {};
cyclic.self = cyclic;

const throwingGetter = {
	get value(): never {
		throw new Error('getter failed');
	}
};

/** The fields a reader sees: method names, signatures and the facts not tied to a method. */
function summary(result: Result) {
	return {
		methods: result.methods.map((method) => ({ name: method.name, signature: method.signature })),
		facts: result.facts
	};
}

test('Projects a recorded service class into CRUD-first methods', () => {
	const result = serviceContract(storeUnit);

	expect(result.methods.map((method) => method.name)).toEqual(['create', 'read']);
	expect(result.methods[0]?.signature).toBe('create(record: ReportRecordInput): Promise<ReportRecord>');
	expect(result.facts).toEqual([{ label: 'Errors not tied to a method', value: 'ReportStore.close' }]);
	record('projects-a-recorded-service-class-into-crud-first-methods', 'serviceContract', [
		{ name: 'recorded ReportStore class with create and read methods', input: storeUnit, output: summary(result) }
	]);
});

test('Projects model declarations with authored parameter metadata', () => {
	const result = modelContract(modelUnit);
	const constructor = result.methods.find((method) => method.name === 'constructor');
	const outputs = constructor?.groups.find((group) => group.id === 'outputs');

	expect(result.methods.map((method) => method.signature)).toEqual([
		'create(input: ReportRecordInput): Promise<ReportRecord>',
		'find(id: string): Promise<ReportRecord | null>',
		'delete(id: string): Promise<boolean>',
		'constructor(input: ReportRecordInput)'
	]);
	expect(outputs?.none).toBe('Creates the model.');
	record('projects-model-declarations-with-authored-parameter-metadata', 'modelContract', [
		{ name: 'ReportRecord model with create, find, delete and constructor', input: modelUnit, output: summary(result) }
	]);
});

test('Reports an empty contract when no method is discovered', () => {
	const result = serviceContract(emptyUnit);

	expect(result).toEqual({ methods: [], facts: [] });
	record('reports-an-empty-contract-when-no-method-is-discovered', 'serviceContract', [
		{ name: 'unit with no owned symbols and no fields', input: emptyUnit, output: result }
	]);
});

test('Throws TypeError when an example is a BigInt or cyclic', () => {
	const errors = recordThrows('throws-typeerror-when-an-example-is-a-bigint-or-cyclic', [
		{ symbol: 'serviceContract', input: { parameter: STORE_PARAM, example: 'BigInt 10' }, run: () => serviceContract(withExample(storeUnit, STORE_PARAM, BigInt(10))) },
		{ symbol: 'modelContract', input: { parameter: MODEL_PARAM, example: 'self-referencing object' }, run: () => modelContract(withExample(modelUnit, MODEL_PARAM, cyclic)) }
	]);

	expect(errors[0]).toBeInstanceOf(TypeError);
	expect(errors[1]).toBeInstanceOf(TypeError);
});

test('Throws RangeError when an example is nested too deeply', () => {
	const example = 'object nested 100000 levels deep';
	const errors = recordThrows('throws-rangeerror-when-an-example-is-nested-too-deeply', [
		{ symbol: 'serviceContract', input: { parameter: STORE_PARAM, example }, run: () => serviceContract(withExample(storeUnit, STORE_PARAM, deep(100000))) },
		{ symbol: 'modelContract', input: { parameter: MODEL_PARAM, example }, run: () => modelContract(withExample(modelUnit, MODEL_PARAM, deep(100000))) }
	]);

	expect(errors[0]).toBeInstanceOf(RangeError);
	expect(errors[1]).toBeInstanceOf(RangeError);
});

test('Throws the example callback error when a getter throws', () => {
	const example = 'object whose getter throws';
	const errors = recordThrows('throws-the-example-callback-error-when-a-getter-throws', [
		{ symbol: 'serviceContract', input: { parameter: STORE_PARAM, example }, run: () => serviceContract(withExample(storeUnit, STORE_PARAM, throwingGetter)) },
		{ symbol: 'modelContract', input: { parameter: MODEL_PARAM, example }, run: () => modelContract(withExample(modelUnit, MODEL_PARAM, throwingGetter)) }
	]);

	expect(String(errors[0])).toBe('Error: getter failed');
	expect(String(errors[1])).toBe('Error: getter failed');
});
