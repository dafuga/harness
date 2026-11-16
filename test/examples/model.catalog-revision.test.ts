import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogRevision } from '../../src/models/git-source-history/CatalogRevision';
import type {
	CatalogRevisionAttributes,
	CatalogRevisionCreateInput,
	CatalogRevisionUpdateInput
} from '../../src/models/git-source-history/CatalogRevision.types';

const revisionData = {
	commit: '9a4f1c03e7b25d8a6f0c13e92b7d4a5180ef6c2b',
	tree: '5d2e8f1a0c9b4e7d3f6a2b8c1e9d0f4a7b3c6e25',
	parents: ['c71e0b5a9d43f286e1a0b7c59d3f4e8a2b61d074'],
	subject: 'Add evidence grid to the reports unit',
	author: 'Jordan Lee',
	authoredAt: '2026-11-09T16:05:12+00:00',
	committedAt: '2026-11-09T16:07:40+00:00',
	branches: ['main'],
	retained: false,
	coverage: 'unverified' as const,
	gaps: ['no evidence record for this commit'],
	records: [],
	reasons: 0,
	legacy: [],
	detail: 'revisions/9a4f1c03e7b25d8a6f0c13e92b7d4a5180ef6c2b.json'
};
const row: CatalogRevisionAttributes = {
	id: revisionData.commit,
	subject: revisionData.subject,
	committedAt: revisionData.committedAt,
	coverage: revisionData.coverage,
	registryAvailable: false,
	data: revisionData
};

function makeAdapter(result: unknown, calls: unknown[]) {
	return {
		find: async <T>(table: string, id: string) => {
			calls.push([table, id]);
			return result as T;
		},
		findBy: async <T>(table: string, fields: Record<string, unknown>) => {
			calls.push([table, fields]);
			return result as T[];
		},
		create: async <T>(table: string, input: Record<string, unknown>) => {
			calls.push([table, input]);
			return result as T;
		},
		update: async <T>(table: string, id: string, input: Record<string, unknown>) => {
			calls.push([table, id, input]);
			return result as T;
		},
		delete: async (table: string, id: string) => {
			calls.push([table, id]);
			return result as boolean;
		}
	};
}

test('Finds a revision by its commit id', async () => {
	const calls: unknown[] = [];
	const result = await CatalogRevision.find(makeAdapter(row, calls), row.id);
	expect(result).toEqual(row);
	recordExampleCases(
		{ unitId: 'model.catalog-revision', symbol: 'CatalogRevision.find', state: 'finds-a-revision-by-its-commit-id', evidence: 'examples-cases', file: 'finds-a-revision-by-its-commit-id.json' },
		[{ name: 'returns the adapter row and forwards table and id', input: { id: row.id }, output: { row: result, call: calls[0] } }]
	);
});

test('Finds revisions by copied filter fields', async () => {
	const calls: unknown[] = [];
	const filter = { coverage: 'unverified' };
	const result = await CatalogRevision.findBy(makeAdapter([row], calls), filter);
	expect(result).toEqual([row]);
	expect(calls[0]).toEqual(['catalog_revisions', filter]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision', symbol: 'CatalogRevision.findBy', state: 'finds-revisions-by-copied-filter-fields', evidence: 'examples-cases', file: 'finds-revisions-by-copied-filter-fields.json' },
		[{ name: 'returns adapter rows for the supplied filter', input: filter, output: result }]
	);
});

test('Creates a revision with its complete indexed data', async () => {
	const calls: unknown[] = [];
	const input: CatalogRevisionCreateInput = row;
	const result = await CatalogRevision.create(makeAdapter(row, calls), input);
	expect(result).toEqual(row);
	expect((calls[0] as unknown[])[1]).toEqual(input);
	recordExampleCases(
		{ unitId: 'model.catalog-revision', symbol: 'CatalogRevision.create', state: 'creates-a-revision-with-its-complete-indexed-data', evidence: 'examples-cases', file: 'creates-a-revision-with-its-complete-indexed-data.json' },
		[{ name: 'passes the complete revision to create and returns its row', input, output: result }]
	);
});

test('Updates a revision with an optional patch', async () => {
	const calls: unknown[] = [];
	const patch: CatalogRevisionUpdateInput = { coverage: 'verified', registryAvailable: true };
	const updated = { ...row, ...patch };
	const result = await CatalogRevision.update(makeAdapter(updated, calls), row.id, patch);
	expect(result).toEqual(updated);
	expect(calls[0]).toEqual(['catalog_revisions', row.id, patch]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision', symbol: 'CatalogRevision.update', state: 'updates-a-revision-with-an-optional-patch', evidence: 'examples-cases', file: 'updates-a-revision-with-an-optional-patch.json' },
		[{ name: 'forwards id and patch and returns the adapter row', input: { id: row.id, patch }, output: result }]
	);
});

test('Deletes a revision by its commit id', async () => {
	const calls: unknown[] = [];
	const result = await CatalogRevision.delete(makeAdapter(true, calls), row.id);
	expect(result).toBe(true);
	expect(calls[0]).toEqual(['catalog_revisions', row.id]);
	recordExampleCases(
		{ unitId: 'model.catalog-revision', symbol: 'CatalogRevision.delete', state: 'deletes-a-revision-by-its-commit-id', evidence: 'examples-cases', file: 'deletes-a-revision-by-its-commit-id.json' },
		[{ name: 'returns the adapter deletion result', input: { id: row.id }, output: result }]
	);
});
