import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogMetadata } from '../../src/models/git-source-history/CatalogMetadata';
import type {
	CatalogMetadataAttributes,
	CatalogMetadataCreateInput,
	CatalogMetadataUpdateInput
} from '../../src/models/git-source-history/CatalogMetadata.types';

const row: CatalogMetadataAttributes = {
	id: 'catalog-metadata',
	schemaVersion: 1,
	digest: 'catalog-source-digest-v1'
};

function adapter(overrides: Record<string, (...args: never[]) => unknown> = {}) {
	return {
		find: async <T>(_table: string, _id: number | string) => row as T,
		findBy: async <T>(_table: string, _fields: Record<string, unknown>) => [row] as T[],
		create: async <T>(_table: string, _input: Record<string, unknown>) => row as T,
		update: async <T>(_table: string, _id: number | string, _input: Record<string, unknown>) => row as T,
		delete: async (_table: string, _id: number | string) => true,
		...overrides
	};
}

test('Finds a catalog metadata row by id', async () => {
	const found = await CatalogMetadata.find(adapter(), row.id);
	expect(found).toEqual(row);
	recordExampleCases(
		{ unitId: 'model.catalog-metadata', symbol: 'CatalogMetadata.find', state: 'finds-a-catalog-metadata-row-by-id', evidence: 'examples-cases', file: 'finds-a-catalog-metadata-row-by-id.json' },
		[{ name: 'lookup returns adapter row', input: { id: row.id }, output: found }]
	);
});

test('Finds rows matching catalog metadata fields', async () => {
	const fields = { schemaVersion: 1 };
	const found = await CatalogMetadata.findBy(adapter(), fields);
	expect(found).toEqual([row]);
	recordExampleCases(
		{ unitId: 'model.catalog-metadata', symbol: 'CatalogMetadata.findBy', state: 'finds-rows-matching-catalog-metadata-fields', evidence: 'examples-cases', file: 'finds-rows-matching-catalog-metadata-fields.json' },
		[{ name: 'filter returns matching rows', input: fields, output: found }]
	);
});

test('Creates a catalog metadata row', async () => {
	const input: CatalogMetadataCreateInput = row;
	const created = await CatalogMetadata.create(adapter(), input);
	expect(created).toEqual(row);
	recordExampleCases(
		{ unitId: 'model.catalog-metadata', symbol: 'CatalogMetadata.create', state: 'creates-a-catalog-metadata-row', evidence: 'examples-cases', file: 'creates-a-catalog-metadata-row.json' },
		[{ name: 'create returns persisted attributes', input, output: created }]
	);
});

test('Updates a catalog metadata row', async () => {
	const patch: CatalogMetadataUpdateInput = { schemaVersion: 2 };
	const updated = await CatalogMetadata.update(adapter(), row.id, patch);
	expect(updated).toEqual(row);
	recordExampleCases(
		{ unitId: 'model.catalog-metadata', symbol: 'CatalogMetadata.update', state: 'updates-a-catalog-metadata-row', evidence: 'examples-cases', file: 'updates-a-catalog-metadata-row.json' },
		[{ name: 'update returns adapter result', input: { id: row.id, patch }, output: updated }]
	);
});

test('Deletes a catalog metadata row', async () => {
	const deleted = await CatalogMetadata.delete(adapter(), row.id);
	expect(deleted).toBe(true);
	recordExampleCases(
		{ unitId: 'model.catalog-metadata', symbol: 'CatalogMetadata.delete', state: 'deletes-a-catalog-metadata-row', evidence: 'examples-cases', file: 'deletes-a-catalog-metadata-row.json' },
		[{ name: 'delete returns adapter result', input: { id: row.id }, output: deleted }]
	);
});

test('Throws persistence failure when an adapter rejects', async () => {
	const failure = new Error('catalog metadata store unavailable');
	const persistence = adapter({ find: async () => Promise.reject(failure) });
	const result = CatalogMetadata.find(persistence, row.id);
	await expect(result).rejects.toBe(failure);
	recordExampleCases(
		{ unitId: 'model.catalog-metadata', symbol: 'CatalogMetadata.find', state: 'throws-persistence-failure-when-an-adapter-rejects', evidence: 'examples-cases', file: 'throws-persistence-failure-when-an-adapter-rejects.json' },
		[{ name: 'adapter rejection reaches caller', input: { id: row.id }, error: { name: failure.name, message: failure.message } }]
	);
});
