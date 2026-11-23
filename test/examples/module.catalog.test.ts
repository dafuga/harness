import type { ErrorValue, Options } from './module.catalog.test.types';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'vitest';
import { CatalogRepository } from '../../src/lib/git-source-history/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const paginationMessage = 'Invalid catalog pagination';

function meta(state: string, symbol: string) {
	return {
		unitId: 'module.catalog',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function errorOf(action: () => unknown): ErrorValue {
	try {
		action();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	return { name: '', message: '' };
}

async function withDatabase<T>(prefix: string, use: (db: DatabaseSync) => T): Promise<T> {
	return withTempDir(prefix, (directory) => {
		const db = new DatabaseSync(join(directory, 'catalog.sqlite'));
		try {
			return use(db);
		} finally {
			db.close();
		}
	});
}

function valueFor(column: string, version: number): string | number {
	if (column === 'id') return 'catalog';
	if (column === 'schema_version') return version;
	return '';
}

function insertSchemaVersion(db: DatabaseSync, version: number): void {
	const columns = (
		db.prepare('PRAGMA table_info(catalog_metadata)').all() as Array<{ name: string }>
	).map((column) => column.name);
	const placeholders = columns.map(() => '?').join(', ');
	db.prepare(
		`INSERT OR REPLACE INTO catalog_metadata (${columns.join(', ')}) VALUES (${placeholders})`
	).run(...columns.map((column) => valueFor(column, version)));
}

test('Lists no entities in an empty catalog', async () => {
	await withDatabase('catalog-empty-', (db) => {
		const repository = new CatalogRepository(db);
		const entities = repository.entities({ limit: 10 });

		expect(entities).toEqual([]);
		recordExampleCases(meta('lists-no-entities-in-an-empty-catalog', 'entities'), [
			{
				name: 'fresh catalog with no branches returns an empty page',
				input: { limit: 10 },
				output: entities
			}
		]);
	});
});

test('Rejects pagination outside the allowed range', async () => {
	await withDatabase('catalog-pagination-', (db) => {
		const repository = new CatalogRepository(db);
		const inputs: Options[] = [{ limit: 0 }, { limit: 10001 }, { limit: 1.5 }, { offset: -1 }];
		const cases = inputs.map((input) => ({
			name: `rejects ${JSON.stringify(input)}`,
			input,
			error: errorOf(() => repository.entities(input))
		}));

		expect(cases.map((item) => item.error.message)).toEqual(cases.map(() => paginationMessage));
		recordExampleCases(meta('rejects-pagination-outside-the-allowed-range', 'entities'), cases);
	});
});

test('Rejects an unsupported catalog schema version', async () => {
	await withDatabase('catalog-schema-', (db) => {
		expect(() => new CatalogRepository(db)).not.toThrow();
		insertSchemaVersion(db, 2);
		const error = errorOf(() => new CatalogRepository(db, false));

		expect(error.message).toBe('Unsupported SQLite catalog schema version');
		recordExampleCases(meta('rejects-an-unsupported-catalog-schema-version', 'CatalogRepository'), [
			{
				name: 'reopening a catalog whose metadata row has schema version 2 is rejected',
				input: { schemaVersion: 2 },
				error
			}
		]);
	});
});
