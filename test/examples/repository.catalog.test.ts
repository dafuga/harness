import { HEAD, BASE, INDEX } from './repository.catalog.fixture';
import type { Unit, Snapshots } from './repository.catalog.test.types';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { CatalogRepository } from '../../src/repositories/git-source-history/CatalogRepository';
import { InvalidCatalogError } from '../../src/repositories/git-source-history/CatalogRepository.types';
import type { CatalogQuery } from '../../src/repositories/git-source-history/CatalogRepository.types';
const OUT_OF_RANGE: CatalogQuery[] = [{ limit: 0 }, { limit: 10001 }, { offset: -1 }];

const DEPENDENCIES = [
	'adapter.sqlite',
	'function.catalog-models',
	'function.history-index-types',
	'function.revision-registry',
	'function.sqlite-types',
	'service.catalog-write'
].map((unit) => ({ unit, via: 'import' }));

const CATALOG_UNIT = {
	id: 'repository.catalog',
	kind: 'repository',
	status: 'active',
	title: 'CatalogRepository',
	responsibility: 'Owns the CatalogRepository persistence boundary.',
	version: 'c0a7e3f19d2b6845',
	dependencies: DEPENDENCIES,
	scenarios: [],
	owns: {
		source: ['src/repositories/git-source-history/CatalogRepository.ts'],
		symbols: ['CatalogRepository']
	}
} as unknown as Unit;

const SNAPSHOTS = [
	{
		commit: HEAD,
		registry: {
			available: true,
			units: [CATALOG_UNIT],
			scenarios: [],
			graph: { nodes: [], edges: [] }
		}
	},
	{
		commit: BASE,
		registry: {
			available: false,
			gap: 'no unit registry is stored at this revision',
			units: [],
			scenarios: [],
			graph: { nodes: [], edges: [] }
		}
	}
] as unknown as Snapshots;

// Opens a real SQLite file in a temporary directory and gives the repository to `use`.
function withCatalog<T>(use: (repository: CatalogRepository) => T): Promise<T> {
	return withTempDir('catalog-repository-', (directory) => {
		const database = new DatabaseSync(join(directory, 'catalog.sqlite'));
		try {
			return use(new CatalogRepository(database));
		} finally {
			database.close();
		}
	});
}

function errorOf(run: () => unknown): { name: string; message: string } {
	try {
		run();
		return { name: 'none', message: '' };
	} catch (error) {
		const caught = error as Error;
		return { name: caught.name, message: caught.message };
	}
}

test('Replaces the query index and lists the head unit', async () => {
	const result = await withCatalog((repository) => {
		repository.replace(INDEX, SNAPSHOTS);
		return { units: repository.entities(), records: repository.records() };
	});
	const ids = result.units.map((unit) => unit.id);

	expect(ids).toEqual(['repository.catalog']);
	expect(result.records).toHaveLength(1);
	recordExampleCases(
		{
			unitId: 'repository.catalog',
			symbol: 'replace',
			state: 'replaces-the-query-index-and-lists-the-head-unit',
			evidence: 'examples-cases',
			file: 'replaces-the-query-index-and-lists-the-head-unit.json'
		},
		[
			{
				name: 'head commit stores one unit and one verification record',
				input: { commit: HEAD },
				output: { units: ids, recordIds: result.records.map((record) => record.id) }
			}
		]
	);
});

test('Lists dependencies, consumers and history at the catalog head', async () => {
	const result = await withCatalog((repository) => {
		repository.replace(INDEX, SNAPSHOTS);
		return {
			dependencies: repository.dependencies('repository.catalog'),
			consumers: repository.consumers('service.catalog-write'),
			history: repository.history('repository.catalog').map((revision) => revision.commit),
			unknown: repository.dependencies('unit.missing')
		};
	});

	expect(result.dependencies).toEqual(DEPENDENCIES);
	expect(result.consumers).toEqual([{ unit: 'repository.catalog', via: 'import' }]);
	expect(result.history).toEqual([HEAD]);
	expect(result.unknown).toEqual([]);
	recordExampleCases(
		{
			unitId: 'repository.catalog',
			symbol: 'dependencies',
			state: 'lists-dependencies-consumers-and-history-at-the-catalog-head',
			evidence: 'examples-cases',
			file: 'lists-dependencies-consumers-and-history-at-the-catalog-head.json'
		},
		[
			{
				name: 'repository.catalog depends on six units at the head commit',
				input: { unitId: 'repository.catalog' },
				output: result.dependencies
			},
			{
				name: 'service.catalog-write is consumed by repository.catalog',
				input: { unitId: 'service.catalog-write' },
				output: result.consumers
			},
			{
				name: 'unknown unit id returns an empty dependency list',
				input: { unitId: 'unit.missing' },
				output: result.unknown
			}
		]
	);
});

test('Rejects entity pagination outside the allowed range', async () => {
	const rejected = await withCatalog((repository) => {
		repository.replace(INDEX, SNAPSHOTS);
		return OUT_OF_RANGE.map((query) => errorOf(() => repository.entities(query)));
	});

	expect(rejected.map((error) => error.name)).toEqual(
		OUT_OF_RANGE.map(() => InvalidCatalogError.name)
	);
	expect(rejected[0]?.message).toBe('Invalid catalog pagination');
	recordExampleCases(
		{
			unitId: 'repository.catalog',
			symbol: 'entities',
			state: 'rejects-entity-pagination-outside-the-allowed-range',
			evidence: 'examples-cases',
			file: 'rejects-entity-pagination-outside-the-allowed-range.json'
		},
		OUT_OF_RANGE.map((query, index) => ({
			name: `pagination ${JSON.stringify(query)} is rejected`,
			input: query,
			error: rejected[index]
		}))
	);
});
