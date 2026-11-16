import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogRevisionEntity } from '../../src/models/git-source-history/CatalogRevisionEntity';
import type { CatalogRevisionEntityAttributes } from '../../src/models/git-source-history/CatalogRevisionEntity.types';

const row: CatalogRevisionEntityAttributes = {
	id: 'catalog-revision-entity-001',
	commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
	entityId: 'catalog-entity-042'
};
const table = 'catalog_revision_entities';
const adapter = (methods: Record<string, (...args: unknown[]) => unknown>) =>
	methods as unknown as Parameters<typeof CatalogRevisionEntity.find>[0];

test('Finds a revision entity by row identifier', async () => {
	const calls: unknown[][] = [];
	const persistence = adapter({ find: async (...args: unknown[]) => { calls.push(args); return row; } });
	const result = await CatalogRevisionEntity.find(persistence, row.id);
	expect(result).toEqual(row);
	expect(calls).toEqual([[table, row.id]]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision-entity', symbol: 'CatalogRevisionEntity.find', state: 'finds-a-revision-entity-by-row-identifier', evidence: 'examples-cases', file: 'finds-a-revision-entity-by-row-identifier.json' },
		[{ name: 'adapter returns the matching membership row', input: { id: row.id }, output: result }]
	);
});

test('Finds revision entities by partial attributes', async () => {
	const calls: unknown[][] = [];
	const filters = { entityId: row.entityId };
	const persistence = adapter({ findBy: async (...args: unknown[]) => { calls.push(args); return [row]; } });
	const result = await CatalogRevisionEntity.findBy(persistence, filters);
	expect(result).toEqual([row]);
	expect(calls).toEqual([[table, filters]]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision-entity', symbol: 'CatalogRevisionEntity.findBy', state: 'finds-revision-entities-by-partial-attributes', evidence: 'examples-cases', file: 'finds-revision-entities-by-partial-attributes.json' },
		[{ name: 'adapter returns rows matching the entity filter', input: filters, output: result }]
	);
});

test('Creates a revision entity membership row', async () => {
	const calls: unknown[][] = [];
	const persistence = adapter({ create: async (...args: unknown[]) => { calls.push(args); return row; } });
	const result = await CatalogRevisionEntity.create(persistence, row);
	expect(result).toEqual(row);
	expect(calls).toEqual([[table, row]]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision-entity', symbol: 'CatalogRevisionEntity.create', state: 'creates-a-revision-entity-membership-row', evidence: 'examples-cases', file: 'creates-a-revision-entity-membership-row.json' },
		[{ name: 'adapter persists complete supplied attributes', input: row, output: result }]
	);
});

test('Updates revision entity attributes by identifier', async () => {
	const calls: unknown[][] = [];
	const patch = { entityId: 'catalog-entity-077' };
	const updated = { ...row, ...patch };
	const persistence = adapter({ update: async (...args: unknown[]) => { calls.push(args); return updated; } });
	const result = await CatalogRevisionEntity.update(persistence, row.id, patch);
	expect(result).toEqual(updated);
	expect(calls).toEqual([[table, row.id, patch]]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision-entity', symbol: 'CatalogRevisionEntity.update', state: 'updates-revision-entity-attributes-by-identifier', evidence: 'examples-cases', file: 'updates-revision-entity-attributes-by-identifier.json' },
		[{ name: 'adapter returns the updated membership row', input: { id: row.id, patch }, output: result }]
	);
});

test('Deletes a revision entity membership row', async () => {
	const calls: unknown[][] = [];
	const persistence = adapter({ delete: async (...args: unknown[]) => { calls.push(args); return true; } });
	const result = await CatalogRevisionEntity.delete(persistence, row.id);
	expect(result).toBe(true);
	expect(calls).toEqual([[table, row.id]]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision-entity', symbol: 'CatalogRevisionEntity.delete', state: 'deletes-a-revision-entity-membership-row', evidence: 'examples-cases', file: 'deletes-a-revision-entity-membership-row.json' },
		[{ name: 'adapter confirms deletion of the identified row', input: { id: row.id }, output: result }]
	);
});
