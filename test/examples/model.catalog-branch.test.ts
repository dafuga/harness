import { test } from 'vitest';
import { CatalogBranch } from '../../src/models/git-source-history/CatalogBranch';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function adapterFor(result: unknown) {
	const calls: unknown[][] = [];
	return {
		calls,
		adapter: {
			async find<T>(table: string, id: number | string): Promise<T | null> {
				calls.push(['find', table, id]);
				return result as T | null;
			},
			async findBy<T>(table: string, fields: Record<string, unknown>): Promise<T[]> {
				calls.push(['findBy', table, fields]);
				return result as T[];
			},
			async create<T>(table: string, input: Record<string, unknown>): Promise<T> {
				calls.push(['create', table, input]);
				return result as T;
			},
			async update<T>(table: string, id: number | string, input: Record<string, unknown>): Promise<T | null> {
				calls.push(['update', table, id, input]);
				return result as T | null;
			},
			async delete(table: string, id: number | string): Promise<boolean> {
				calls.push(['delete', table, id]);
				return result as boolean;
			}
		}
	};
}

test('Finds a branch by id', async () => {
	const row = { id: 'main', head: 'a1b2c3' };
	const { adapter, calls } = adapterFor(row);
	const output = await CatalogBranch.find(adapter, 'main');
	expect(output).toEqual(row);
	expect(calls).toEqual([['find', 'catalog_branches', 'main']]);
	recordExampleCases({ unitId: 'model.catalog-branch', symbol: 'CatalogBranch.find', state: 'finds-a-branch-by-id', evidence: 'examples-cases', file: 'finds-a-branch-by-id.json' }, [
		{ name: 'find main returns its stored head', input: { id: 'main' }, output }
	]);
});

test('Finds branches by attributes', async () => {
	const rows = [{ id: 'main', head: 'a1b2c3' }];
	const { adapter, calls } = adapterFor(rows);
	const output = await CatalogBranch.findBy(adapter, { head: 'a1b2c3' });
	expect(output).toEqual(rows);
	expect(calls).toEqual([['findBy', 'catalog_branches', { head: 'a1b2c3' }]]);
	recordExampleCases({ unitId: 'model.catalog-branch', symbol: 'CatalogBranch.findBy', state: 'finds-branches-by-attributes', evidence: 'examples-cases', file: 'finds-branches-by-attributes.json' }, [
		{ name: 'head filter returns matching branches', input: { head: 'a1b2c3' }, output }
	]);
});

test('Creates a branch row', async () => {
	const row = { id: 'release/1', head: 'd4e5f6' };
	const { adapter, calls } = adapterFor(row);
	const output = await CatalogBranch.create(adapter, row);
	expect(output).toEqual(row);
	expect(calls).toEqual([['create', 'catalog_branches', row]]);
	recordExampleCases({ unitId: 'model.catalog-branch', symbol: 'CatalogBranch.create', state: 'creates-a-branch-row', evidence: 'examples-cases', file: 'creates-a-branch-row.json' }, [
		{ name: 'creation passes the supplied branch identity and head', input: row, output }
	]);
});

test('Updates a branch head', async () => {
	const row = { id: 'main', head: 'd4e5f6' };
	const update = { head: 'd4e5f6' };
	const { adapter, calls } = adapterFor(row);
	const output = await CatalogBranch.update(adapter, 'main', update);
	expect(output).toEqual(row);
	expect(calls).toEqual([['update', 'catalog_branches', 'main', update]]);
	recordExampleCases({ unitId: 'model.catalog-branch', symbol: 'CatalogBranch.update', state: 'updates-a-branch-head', evidence: 'examples-cases', file: 'updates-a-branch-head.json' }, [
		{ name: 'update passes a partial head change', input: { id: 'main', ...update }, output }
	]);
});

test('Deletes a branch row', async () => {
	const { adapter, calls } = adapterFor(true);
	const output = await CatalogBranch.delete(adapter, 'release/1');
	expect(output).toBe(true);
	expect(calls).toEqual([['delete', 'catalog_branches', 'release/1']]);
	recordExampleCases({ unitId: 'model.catalog-branch', symbol: 'CatalogBranch.delete', state: 'deletes-a-branch-row', evidence: 'examples-cases', file: 'deletes-a-branch-row.json' }, [
		{ name: 'delete returns the adapter confirmation', input: { id: 'release/1' }, output }
	]);
});
