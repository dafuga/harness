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
	responsibility:
		'Stores versioned unit metadata in catalog_entities through a supplied persistence adapter.',
	data: {
		id: 'model.catalog-entity',
		kind: 'model',
		status: 'active'
	} as CatalogEntityAttributes['data']
};

const adapter = (overrides: Partial<PersistenceAdapter> = {}): PersistenceAdapter => ({
	find: overrides.find ?? (async <T>() => row as T),
	findBy: overrides.findBy ?? (async <T>() => [row as T]),
	create:
		overrides.create ?? (async <T>(_table: string, input: Record<string, unknown>) => input as T),
	update: overrides.update ?? (async <T>() => row as T),
	delete: overrides.delete ?? (async () => true)
});

const record = (state: string, symbol: string, input: unknown, output: unknown) =>
	recordExampleCases(
		{
			unitId: 'model.catalog-entity',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: state, input, output }]
	);

test('Finds catalog rows by id and copied filters', async () => {
	const result = await CatalogEntity.find(adapter(), row.id);
	expect(result).toEqual(row);
	const byId = { name: 'find by id', input: { id: row.id }, output: result };
	let received: unknown;
	const filter = { kind: 'model' };
	const filtered = await CatalogEntity.findBy(
		adapter({
			findBy: async <T>(_table: string, fields: Record<string, unknown>) => {
				received = fields;
				return [row as T];
			}
		}),
		filter
	);
	expect(filtered).toEqual([row]);
	expect(received).toEqual(filter);
	recordExampleCases(
		{
			unitId: 'model.catalog-entity',
			symbol: 'CatalogEntity.find',
			state: 'finds-catalog-rows-by-id-and-copied-filters',
			evidence: 'examples-cases',
			file: 'finds-catalog-rows-by-id-and-copied-filters.json'
		},
		[byId, { name: 'find by filter', input: filter, output: filtered }]
	);
});

test('Creates a row from copied input fields', async () => {
	const input: CatalogEntityCreateInput = { ...row };
	let received: unknown;
	const result = await CatalogEntity.create(
		adapter({
			create: async <T>(_table: string, value: Record<string, unknown>) => {
				received = value;
				return value as T;
			}
		}),
		input
	);
	expect(result).toEqual(row);
	expect(received).not.toBe(input);
	record('creates-a-row-from-copied-input-fields', 'CatalogEntity.create', input, result);
});

test('Updates a row with partial fields', async () => {
	const input: CatalogEntityUpdateInput = { title: 'CatalogRevision' };
	const result = await CatalogEntity.update(adapter(), row.id, input);
	expect(result).toEqual(row);
	record(
		'updates-a-row-with-partial-fields',
		'CatalogEntity.update',
		{ id: row.id, input },
		result
	);
});

test('Deletes a row and returns the adapter result', async () => {
	const result = await CatalogEntity.delete(adapter({ delete: async () => false }), row.id);
	expect(result).toBe(false);
	record(
		'deletes-a-row-and-returns-the-adapter-result',
		'CatalogEntity.delete',
		{ id: row.id },
		result
	);
});

test('Throws Caller field getter exception during copy', async () => {
	const input = Object.defineProperty({}, 'kind', {
		enumerable: true,
		get() {
			throw new Error('field getter failed');
		}
	});
	let message = '';
	try {
		await CatalogEntity.findBy(adapter(), input);
	} catch (error) {
		message = (error as Error).message;
	}
	expect(message).toBe('field getter failed');
	recordExampleCases(
		{
			unitId: 'model.catalog-entity',
			symbol: 'CatalogEntity.findBy',
			state: 'throws-caller-field-getter-exception-during-copy',
			evidence: 'examples-cases',
			file: 'throws-caller-field-getter-exception-during-copy.json'
		},
		[{ name: 'throwing filter getter', input: { kind: '[throwing getter]' }, error: message }]
	);
});

test('Throws TypeError when the adapter lacks find', async () => {
	const invalidAdapter = {} as PersistenceAdapter;
	let message = '';
	try {
		await CatalogEntity.find(invalidAdapter, row.id);
	} catch (error) {
		message = (error as Error).message;
	}
	expect(message).toContain('find');
	recordExampleCases(
		{
			unitId: 'model.catalog-entity',
			symbol: 'CatalogEntity.find',
			state: 'throws-typeerror-when-the-adapter-lacks-find',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-adapter-lacks-find.json'
		},
		[{ name: 'adapter without find', input: { id: row.id, adapter: {} }, error: message }]
	);
});
