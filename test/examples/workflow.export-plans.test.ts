import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	modelExportPlans,
	adapterExportPlan,
	pieceExportPlans
} from '../../src/workflows/projects-sessions/generate-code/exportPlans';

const unknownKind = 'nothing' as Parameters<typeof pieceExportPlans>[0];
const pieceCases = [
	['service', 'invoice'],
	['util', 'slugify'],
	['seeder', 'users']
] as const;

function meta(symbol: string, state: string) {
	return { unitId: 'workflow.export-plans', symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Builds the two model export plans for a name', () => {
	const plans = modelExportPlans('invoice');
	expect(plans).toEqual([
		{ source: './models/Invoice', named: ['Invoice'] },
		{
			source: './models/Invoice.types',
			types: ['InvoiceAttributes', 'InvoiceCreateInput', 'InvoiceUpdateInput']
		}
	]);
	recordExampleCases(meta('modelExportPlans', 'builds-the-two-model-export-plans-for-a-name'), [
		{ name: 'invoice model plans', input: { name: 'invoice' }, output: plans },
		{ name: 'customer model plans', input: { name: 'customer' }, output: modelExportPlans('customer') }
	]);
});

test('Builds the adapter export plan with the D1 special case', () => {
	const d1 = adapterExportPlan('d1');
	const postgres = adapterExportPlan('postgres');
	expect(d1).toEqual({ source: './models/adapters/d1', named: ['createD1Adapter'] });
	expect(postgres).toEqual({ source: './models/adapters/postgres', named: ['createPostgresAdapter'] });
	recordExampleCases(meta('adapterExportPlan', 'builds-the-adapter-export-plan-with-the-d1-special-case'), [
		{ name: 'd1 adapter plan', input: { adapter: 'd1' }, output: d1 },
		{ name: 'postgres adapter plan', input: { adapter: 'postgres' }, output: postgres }
	]);
});

test('Builds piece export plans for class and util kinds', () => {
	const plans = pieceCases.map(([kind, name]) => pieceExportPlans(kind, name));
	expect(plans).toEqual([
		[{ source: './services/InvoiceService', named: ['InvoiceService'] }],
		[{ source: './utils/slugify', named: ['slugify'] }],
		[{ source: '../db/seed-data/users', named: ['seedUsers'] }]
	]);
	recordExampleCases(meta('pieceExportPlans', 'builds-piece-export-plans-for-class-and-util-kinds'), [
		...pieceCases.map(([kind, name], index) => ({
			name: `${kind} piece plan`,
			input: { kind, name },
			output: plans[index]
		}))
	]);
});

test('Returns no export plans for a kind without a pattern', () => {
	const plans = pieceExportPlans(unknownKind, 'invoice');
	expect(plans).toEqual([]);
	recordExampleCases(meta('pieceExportPlans', 'returns-no-export-plans-for-a-kind-without-a-pattern'), [
		{ name: 'kind without an export pattern', input: { kind: 'nothing', name: 'invoice' }, output: plans }
	]);
});
