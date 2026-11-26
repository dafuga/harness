import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { serviceContract } from '../../src/components/explorer-ui/entity-contract/serviceMethods';
import type {
	Unit,
	Fields,
	Result
} from './reports.component.explorer-ui-entity-contract-service-methods.test.types';

const ID = 'reports.component.explorer-ui-entity-contract-service-methods';
export const STORE_SOURCE = 'packages/reports/src/components/report-store/ReportStore.ts';
export const STORE_PARAM = 'ReportStore.create.record';

function runtimeOf(source: string): Unit['runtime'] {
	return { kind: 'module', targets: [{ kind: 'module', entry: source }] };
}

export function unitOf(id: string, title: string, source: string, fields: Fields): Unit {
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

export const storeUnit = unitOf('reports.component.report-store', 'ReportStore', STORE_SOURCE, {
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

export function record(
	state: string,
	symbol: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	recordExampleCases(
		{ unitId: ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

/** The fields a reader sees: method names, signatures and the facts not tied to a method. */
export function summary(result: Result) {
	return {
		methods: result.methods.map((method) => ({ name: method.name, signature: method.signature })),
		facts: result.facts
	};
}

test('Projects a recorded service class into CRUD-first methods', () => {
	const result = serviceContract(storeUnit);

	expect(result.methods.map((method) => method.name)).toEqual(['create', 'read']);
	expect(result.methods[0]?.signature).toBe(
		'create(record: ReportRecordInput): Promise<ReportRecord>'
	);
	expect(result.facts).toEqual([
		{ label: 'Errors not tied to a method', value: 'ReportStore.close' }
	]);
	record('projects-a-recorded-service-class-into-crud-first-methods', 'serviceContract', [
		{
			name: 'recorded ReportStore class with create and read methods',
			input: storeUnit,
			output: summary(result)
		}
	]);
});
