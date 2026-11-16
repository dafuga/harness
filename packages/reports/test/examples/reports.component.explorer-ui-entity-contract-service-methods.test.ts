import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { serviceContract, modelContract } from '../../src/components/explorer-ui/entity-contract/serviceMethods';

type Unit = Parameters<typeof serviceContract>[0];
type Result = ReturnType<typeof serviceContract>;

const STORE_SOURCE = 'packages/reports/src/components/report-store/ReportStore.ts';
const MODEL_SOURCE = 'packages/reports/src/models/reports/ReportRecord.ts';

function shell(id: string, title: string, source: string): Omit<Unit, 'owns' | 'contract'> {
	return {
		id,
		kind: 'function',
		status: 'active',
		title,
		responsibility: `Example ${title} unit.`,
		dependencies: [],
		scenarios: [],
		runtime: { kind: 'module', targets: [{ kind: 'module', entry: source }] },
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		version: 'a41f0c9e7d2b5863'
	};
}

const storeUnit: Unit = {
	...shell('reports.component.report-store', 'ReportStore', STORE_SOURCE),
	owns: { source: [STORE_SOURCE], symbols: ['ReportStore.create', 'ReportStore.read'] },
	contract: {
		inputs: [{ name: 'ReportStore.create.record', type: 'ReportRecordInput', required: true }],
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
};

const modelUnit: Unit = {
	...shell('reports.model.report-record', 'ReportRecord', MODEL_SOURCE),
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
			{ name: 'ReportRecord.find.id', type: 'string', required: true }
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
				{
					name: 'constructor',
					inputs: [{ name: 'input', type: 'ReportRecordInput' }],
					output: 'ReportRecord'
				},
				{
					name: 'create',
					inputs: [{ name: 'input', type: 'ReportRecordInput' }],
					output: 'Promise<ReportRecord>'
				},
				{
					name: 'find',
					inputs: [{ name: 'id', type: 'string' }],
					output: 'Promise<ReportRecord | null>'
				},
				{ name: 'delete', inputs: [{ name: 'id', type: 'string' }], output: 'Promise<boolean>' }
			]
		}
	]
};

const emptyUnit: Unit = {
	...shell('reports.component.empty', 'Empty', STORE_SOURCE),
	owns: { source: [STORE_SOURCE], symbols: [] },
	contract: { inputs: [], outputs: [], errors: [] }
};

/** The fields a reader sees: method names, signatures and the facts not tied to a method. */
function summary(result: Result) {
	return {
		methods: result.methods.map((method) => ({
			name: method.name,
			signature: method.signature
		})),
		facts: result.facts
	};
}

test('Projects a recorded service class into CRUD-first methods', () => {
	const result = serviceContract(storeUnit);
	const create = result.methods[0];

	expect(result.methods.map((method) => method.name)).toEqual(['create', 'read']);
	expect(create?.signature).toBe('create(record: ReportRecordInput): Promise<ReportRecord>');
	expect(result.facts).toEqual([
		{ label: 'Errors not tied to a method', value: 'ReportStore.close' }
	]);
	recordExampleCases(
		{
			unitId: 'reports.component.explorer-ui-entity-contract-service-methods',
			symbol: 'serviceContract',
			state: 'projects-a-recorded-service-class-into-crud-first-methods',
			evidence: 'examples-cases',
			file: 'projects-a-recorded-service-class-into-crud-first-methods.json'
		},
		[
			{
				name: 'recorded ReportStore class with create and read methods',
				input: storeUnit,
				output: summary(result)
			}
		]
	);
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
	recordExampleCases(
		{
			unitId: 'reports.component.explorer-ui-entity-contract-service-methods',
			symbol: 'modelContract',
			state: 'projects-model-declarations-with-authored-parameter-metadata',
			evidence: 'examples-cases',
			file: 'projects-model-declarations-with-authored-parameter-metadata.json'
		},
		[
			{
				name: 'ReportRecord model with create, find, delete and constructor',
				input: modelUnit,
				output: summary(result)
			}
		]
	);
});

test('Reports an empty contract when no method is discovered', () => {
	const result = serviceContract(emptyUnit);

	expect(result).toEqual({ methods: [], facts: [] });
	recordExampleCases(
		{
			unitId: 'reports.component.explorer-ui-entity-contract-service-methods',
			symbol: 'serviceContract',
			state: 'reports-an-empty-contract-when-no-method-is-discovered',
			evidence: 'examples-cases',
			file: 'reports-an-empty-contract-when-no-method-is-discovered.json'
		},
		[{ name: 'unit with no owned symbols and no fields', input: emptyUnit, output: result }]
	);
});
