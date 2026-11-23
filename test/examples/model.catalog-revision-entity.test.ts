import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CatalogRevisionEntity } from '../../src/models/git-source-history/CatalogRevisionEntity';
import type { CatalogRevisionEntityAttributes } from '../../src/models/git-source-history/CatalogRevisionEntity.types';
import {
	adapter,
	row,
	table,
	updateRevisionEntityExample,
	deleteRevisionEntityExample,
	revisionEntityFailureExample
} from './model.catalog-revision-entity.fixtures';

test('Finds a revision entity by row identifier', async () => {
	const calls: unknown[][] = [];
	const persistence = adapter({
		find: async (...args: unknown[]) => {
			calls.push(args);
			return row;
		}
	});
	const result = await CatalogRevisionEntity.find(persistence, row.id);
	const error = new Error('find failed');
	expect(() =>
		CatalogRevisionEntity.find(
			adapter({
				find: () => {
					throw error;
				}
			}),
			row.id
		)
	).toThrow(error);
	expect(result).toEqual(row);
	expect(calls).toEqual([[table, row.id]]);
	recordExampleCases(
		{
			unitId: 'model.catalog-revision-entity',
			symbol: 'CatalogRevisionEntity.find',
			state: 'finds-a-revision-entity-by-row-identifier',
			evidence: 'examples-cases',
			file: 'finds-a-revision-entity-by-row-identifier.json'
		},
		[
			{
				name: 'adapter returns the matching membership row',
				input: { id: row.id },
				output: result
			},
			{
				name: 'synchronous adapter exception propagates unchanged',
				input: { id: row.id, failure: true },
				error: error.message
			}
		]
	);
});

test('Finds revision entities by partial attributes', async () => {
	const calls: unknown[][] = [];
	const filters = { entityId: row.entityId };
	const persistence = adapter({
		findBy: async (...args: unknown[]) => {
			calls.push(args);
			return [row];
		}
	});
	const result = await CatalogRevisionEntity.findBy(persistence, filters);
	const error = new Error('findBy failed');
	await expect(
		CatalogRevisionEntity.findBy(
			adapter({
				findBy: async () => {
					throw error;
				}
			}),
			filters
		)
	).rejects.toBe(error);
	expect(result).toEqual([row]);
	expect(calls).toEqual([[table, filters]]);
	recordExampleCases(
		{
			unitId: 'model.catalog-revision-entity',
			symbol: 'CatalogRevisionEntity.findBy',
			state: 'finds-revision-entities-by-partial-attributes',
			evidence: 'examples-cases',
			file: 'finds-revision-entities-by-partial-attributes.json'
		},
		[
			{ name: 'adapter returns rows matching the entity filter', input: filters, output: result },
			{
				name: 'rejected adapter promise propagates unchanged',
				input: { ...filters, failure: true },
				error: error.message
			}
		]
	);
});

test('Creates a revision entity membership row', async () => {
	const calls: unknown[][] = [];
	const persistence = adapter({
		create: async (...args: unknown[]) => {
			calls.push(args);
			return row;
		}
	});
	const result = await CatalogRevisionEntity.create(persistence, row);
	const error = new Error('field read failed');
	const invalidInput = Object.defineProperty({}, 'id', {
		enumerable: true,
		get: () => {
			throw error;
		}
	});
	expect(() =>
		CatalogRevisionEntity.create(persistence, invalidInput as CatalogRevisionEntityAttributes)
	).toThrow(error);
	expect(result).toEqual(row);
	expect(calls).toEqual([[table, row]]);
	recordExampleCases(
		{
			unitId: 'model.catalog-revision-entity',
			symbol: 'CatalogRevisionEntity.create',
			state: 'creates-a-revision-entity-membership-row',
			evidence: 'examples-cases',
			file: 'creates-a-revision-entity-membership-row.json'
		},
		[
			{ name: 'adapter persists complete supplied attributes', input: row, output: result },
			{
				name: 'input getter exception propagates before adapter call',
				input: { field: 'id', failure: true },
				error: error.message
			}
		]
	);
});

test('Updates revision entity attributes by identifier', updateRevisionEntityExample);

test('Deletes a revision entity membership row', deleteRevisionEntityExample);

test('Throws adapter or copied-field error unchanged', revisionEntityFailureExample);
