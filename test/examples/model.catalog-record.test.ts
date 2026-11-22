import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogRecord } from '../../src/models/git-source-history/CatalogRecord';
import type { CatalogRecordAttributes } from '../../src/models/git-source-history/CatalogRecord.types';

type Adapter = Parameters<typeof CatalogRecord.find>[0];

const record: CatalogRecordAttributes = {
	id: 'record-20261114-001',
	commit: '0123456789abcdef0123456789abcdef01234567',
	status: 'passed',
	valid: true,
	data: {
		id: 'record-20261114-001',
		status: 'passed',
		profile: 'ci-linux-x64-node22',
		finishedAt: '2026-11-14T13:42:00.000Z',
		base: '89abcdef0123456789abcdef0123456789abcdef',
		valid: true,
		problems: []
	}
};

function memoryAdapter(rows: CatalogRecordAttributes[], calls: unknown[][]): Adapter {
	return {
		find: async (table: string, id: string) => {
			calls.push(['find', table, id]);
			return rows.find((row) => row.id === id) ?? null;
		},
		create: async (table: string, input: Record<string, unknown>) => {
			calls.push(['create', table, input]);
			return input;
		}
	} as unknown as Adapter;
}

test('Finds a stored catalog record by id', async () => {
	const calls: unknown[][] = [];
	const adapter = memoryAdapter([record], calls);
	const found = await CatalogRecord.find(adapter, record.id);
	const missing = await CatalogRecord.find(adapter, 'record-missing');

	expect(found).toEqual(record);
	expect(missing).toBeNull();
	expect(calls).toEqual([
		['find', 'catalog_records', 'record-20261114-001'],
		['find', 'catalog_records', 'record-missing']
	]);
	recordExampleCases(
		{
			unitId: 'model.catalog-record',
			symbol: 'find',
			state: 'finds-a-stored-catalog-record-by-id',
			evidence: 'examples-cases',
			file: 'finds-a-stored-catalog-record-by-id.json'
		},
		[
			{
				name: 'existing id returns the stored row',
				input: { id: 'record-20261114-001' },
				output: found
			},
			{
				name: 'unknown id returns null',
				input: { id: 'record-missing' },
				output: missing
			}
		]
	);
});

test('Creates a catalog record and forwards a copy of the input', async () => {
	const calls: unknown[][] = [];
	const adapter = memoryAdapter([], calls);
	const created = await CatalogRecord.create(adapter, record);

	expect(created).toEqual(record);
	expect(calls).toHaveLength(1);
	expect(calls[0]).toEqual(['create', 'catalog_records', record]);
	expect(calls[0][2]).not.toBe(record);
	recordExampleCases(
		{
			unitId: 'model.catalog-record',
			symbol: 'create',
			state: 'creates-a-catalog-record-and-forwards-a-copy-of-the-input',
			evidence: 'examples-cases',
			file: 'creates-a-catalog-record-and-forwards-a-copy-of-the-input.json'
		},
		[
			{
				name: 'valid passed record is stored and returned unchanged',
				input: record,
				output: created
			}
		]
	);
});

test('Propagates a rejected persistence failure', async () => {
	const adapter = {
		find: async () => {
			throw new Error('database is locked');
		}
	} as unknown as Adapter;
	let error: unknown;
	try {
		await CatalogRecord.find(adapter, record.id);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe('database is locked');
	recordExampleCases(
		{
			unitId: 'model.catalog-record',
			symbol: 'find',
			state: 'propagates-a-rejected-persistence-failure',
			evidence: 'examples-cases',
			file: 'propagates-a-rejected-persistence-failure.json'
		},
		[
			{
				name: 'adapter rejection propagates without conversion',
				input: { id: record.id },
				error: {
					name: (error as Error).name,
					message: (error as Error).message
				}
			}
		]
	);
});
