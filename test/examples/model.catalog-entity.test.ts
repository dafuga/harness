import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogEntity } from '../../src/models/git-source-history/CatalogEntity';
import type { PersistenceAdapter } from '../../src/core/development-tooling/sqliteTypes';
import type {
	CatalogEntityAttributes,
	CatalogEntityCreateInput,
	CatalogEntityUpdateInput
} from '../../src/models/git-source-history/CatalogEntity.types';

const row: CatalogEntityAttributes = {
	id: '6f3a9c1e0d872b54a6e19f2c7d843b05e1c6a92f7d4b8e0c35a1f9d26b7e4c81',
	unitId: 'model.catalog-entity',
	version: '5b0e7c2d9a41f863',
	kind: 'model',
	title: 'CatalogEntity',
	responsibility: 'Stores versioned unit metadata in catalog_entities through a supplied persistence adapter.',
	data: { id: 'model.catalog-entity', kind: 'model', status: 'active' } as CatalogEntityAttributes['data']
};

const adapter = (overrides: Partial<PersistenceAdapter> = {}): PersistenceAdapter => ({
	find: overrides.find ?? (async <T>() => row as T),
	findBy: overrides.findBy ?? (async <T>() => [row as T]),
	create: overrides.create ?? (async <T>(_table: string, input: Record<string, unknown>) => input as T),
	update: overrides.update ?? (async <T>() => row as T),
	delete: overrides.delete ?? (async () => true)
});

const record = (state: string, symbol: string, input: unknown, output: unknown) =>
	recordExampleCases(
		{ unitId: 'model.catalog-entity', symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: state, input, output }]
	);

test('Finds a catalog row by id', async () => {
	const result = await CatalogEntity.find(adapter(), row.id);
	expect(result).toEqual(row);
	record('finds-a-catalog-row-by-id', 'CatalogEntity.find', { id: row.id }, result);
});

test('Finds rows by copied filter fields', async () => {
	let received: unknown;
	const filter = { kind: 'model' };
	const result = await CatalogEntity.findBy(adapter({ findBy: async <T>(_table: string, fields: Record<string, unknown>) => {
		received = fields;
		return [row as T];
	} }), filter);
	expect(result).toEqual([row]);
	expect(received).toEqual(filter);
	record('finds-rows-by-copied-filter-fields', 'CatalogEntity.findBy', filter, result);
});

test('Creates a row from copied input fields', async () => {
	const input: CatalogEntityCreateInput = { ...row };
	let received: unknown;
	const result = await CatalogEntity.create(adapter({ create: async <T>(_table: string, value: Record<string, unknown>) => {
		received = value;
		return value as T;
	} }), input);
	expect(result).toEqual(row);
	expect(received).not.toBe(input);
	record('creates-a-row-from-copied-input-fields', 'CatalogEntity.create', input, result);
});

test('Updates a row with partial fields', async () => {
	const input: CatalogEntityUpdateInput = { title: 'CatalogRevision' };
	const result = await CatalogEntity.update(adapter(), row.id, input);
	expect(result).toEqual(row);
	record('updates-a-row-with-partial-fields', 'CatalogEntity.update', { id: row.id, input }, result);
});

test('Deletes a row and returns the adapter result', async () => {
	const result = await CatalogEntity.delete(adapter({ delete: async () => false }), row.id);
	expect(result).toBe(false);
	record('deletes-a-row-and-returns-the-adapter-result', 'CatalogEntity.delete', { id: row.id }, result);
});
