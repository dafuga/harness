import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogDependency } from '../../src/models/git-source-history/CatalogDependency';
import type { CatalogDependencyAttributes } from '../../src/models/git-source-history/CatalogDependency.types';

const row: CatalogDependencyAttributes = {
	id: 'cd-001',
	entityId: 'entity-42',
	targetId: 'reports.component.evidence-grid',
	via: 'import'
};

function adapterFor<T>(result: T, operation: string, calls: unknown[]) {
	return {
		find: async (table: string, id: string) => {
			calls.push([operation, table, id]);
			return result;
		},
		findBy: async (table: string, fields: unknown) => {
			calls.push([operation, table, fields]);
			return result;
		},
		create: async (table: string, input: unknown) => {
			calls.push([operation, table, input]);
			return result;
		},
		update: async (table: string, id: string, input: unknown) => {
			calls.push([operation, table, id, input]);
			return result;
		},
		delete: async (table: string, id: string) => {
			calls.push([operation, table, id]);
			return result;
		}
	} as unknown as Parameters<typeof CatalogDependency.find>[0];
}

function record(example: {
	symbol: string;
	state: string;
	name: string;
	input: unknown;
	output: unknown;
}) {
	recordExampleCases(
		{
			unitId: 'model.catalog-dependency',
			symbol: example.symbol,
			state: example.state,
			evidence: 'examples-cases',
			file: `${example.state}.json`
		},
		[{ name: example.name, input: example.input, output: example.output }]
	);
}

test('Finds a catalog dependency by id', async () => {
	const calls: unknown[] = [];
	const adapter = adapterFor(row, 'find', calls);
	const result = await CatalogDependency.find(adapter, row.id);
	expect(result).toEqual(row);
	expect(calls).toEqual([['find', 'catalog_dependencies', row.id]]);
	record({
		symbol: 'CatalogDependency.find',
		state: 'finds-a-catalog-dependency-by-id',
		name: 'returns adapter row',
		input: { id: row.id },
		output: row
	});
});

test('Finds catalog dependencies by partial fields', async () => {
	const calls: unknown[] = [];
	const adapter = adapterFor([row], 'findBy', calls);
	const result = await CatalogDependency.findBy(adapter, { entityId: row.entityId });
	expect(result).toEqual([row]);
	expect(calls).toEqual([['findBy', 'catalog_dependencies', { entityId: row.entityId }]]);
	record({
		symbol: 'CatalogDependency.findBy',
		state: 'finds-catalog-dependencies-by-partial-fields',
		name: 'returns matching rows',
		input: { entityId: row.entityId },
		output: [row]
	});
});

test('Creates a catalog dependency row', async () => {
	const calls: unknown[] = [];
	const adapter = adapterFor(row, 'create', calls);
	const result = await CatalogDependency.create(adapter, row);
	expect(result).toEqual(row);
	expect(calls).toEqual([['create', 'catalog_dependencies', row]]);
	record({
		symbol: 'CatalogDependency.create',
		state: 'creates-a-catalog-dependency-row',
		name: 'returns inserted row',
		input: row,
		output: row
	});
});

test('Updates a catalog dependency row', async () => {
	const calls: unknown[] = [];
	const adapter = adapterFor(row, 'update', calls);
	const patch = { via: 'catalog' };
	const result = await CatalogDependency.update(adapter, row.id, patch);
	expect(result).toEqual(row);
	expect(calls).toEqual([['update', 'catalog_dependencies', row.id, patch]]);
	record({
		symbol: 'CatalogDependency.update',
		state: 'updates-a-catalog-dependency-row',
		name: 'returns updated row',
		input: { id: row.id, ...patch },
		output: row
	});
});

test('Deletes a catalog dependency by id', async () => {
	const calls: unknown[] = [];
	const adapter = adapterFor(true, 'delete', calls);
	const result = await CatalogDependency.delete(adapter, row.id);
	expect(result).toBe(true);
	expect(calls).toEqual([['delete', 'catalog_dependencies', row.id]]);
	record({
		symbol: 'CatalogDependency.delete',
		state: 'deletes-a-catalog-dependency-by-id',
		name: 'reports successful deletion',
		input: { id: row.id },
		output: true
	});
});

test('Throws Persistence operation failure when adapter rejects', async () => {
	const failure = new Error('adapter unavailable');
	const adapter = {
		find: async () => {
			throw failure;
		}
	} as unknown as Parameters<typeof CatalogDependency.find>[0];
	await expect(CatalogDependency.find(adapter, row.id)).rejects.toBe(failure);
	recordExampleCases(
		{
			unitId: 'model.catalog-dependency',
			symbol: 'CatalogDependency.find',
			state: 'throws-persistence-operation-failure-when-adapter-rejects',
			evidence: 'examples-cases',
			file: 'throws-persistence-operation-failure-when-adapter-rejects.json'
		},
		[
			{
				name: 'preserves adapter rejection',
				input: { id: row.id },
				error: { name: failure.name, message: failure.message }
			}
		]
	);
});
