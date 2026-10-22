import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { CatalogRepository } from '../../src/repositories/git-source-history/CatalogRepository';
import { catalogModels } from '../../src/core/git-source-history/catalogModels';
import { catalogFixture, firstCommit, secondCommit } from '../support/catalogFixture';

let db: DatabaseSync;
let catalog: CatalogRepository;
beforeEach(() => {
	db = new DatabaseSync(':memory:');
	catalog = new CatalogRepository(db);
});
afterEach(() => db.close());

test('every user table has exactly one model, with no hidden application tables', () => {
	const tables = catalog.adapter.query<{ name: string }>(
		"SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name"
	);
	expect(tables.map((table) => table.name)).toEqual(
		catalogModels.map((model) => model.definition.table).sort()
	);
	catalog.adapter.assertModels();
});

test('versioned entities, dependency directions, filters and history retain their revision', () => {
	const { index, snapshots } = catalogFixture();
	catalog.replace(index, snapshots);
	expect(catalog.entities({ kind: 'model' }).map((entity) => entity.id)).toEqual(['model.post']);
	expect(catalog.entities({ search: 'posts' })).toMatchObject([
		{ id: 'service.posts', responsibility: 'Queries posts' }
	]);
	expect(catalog.entities({ commit: firstCommit, kind: 'service' })).toMatchObject([
		{ responsibility: 'Owns service.posts' }
	]);
	expect(catalog.dependencies('service.posts')).toEqual([{ unit: 'model.post', via: 'import' }]);
	expect(catalog.consumers('model.post')).toEqual([{ unit: 'service.posts', via: 'import' }]);
	expect(catalog.history('model.post').map((revision) => revision.commit)).toEqual([
		secondCommit,
		firstCommit
	]);
	expect(catalog.adapter.query('SELECT id FROM catalog_entities')).toHaveLength(3);
	expect(catalog.entities({ search: "' OR 1=1 --" })).toEqual([]);
	expect(() => catalog.entities({ limit: -1 })).toThrow('pagination');
});

test('replacement removes stale rows and invalid membership rolls back to the previous catalog', () => {
	const { index, snapshots } = catalogFixture();
	catalog.replace(index, snapshots);
	const conflicting = [...snapshots, snapshots[0]];
	expect(() => catalog.replace(index, conflicting)).toThrow(/UNIQUE|constraint/i);
	expect(catalog.history('model.post')).toHaveLength(2);
	catalog.replace({ ...index, revisions: [index.revisions[0]] }, [snapshots[1]]);
	expect(catalog.history('model.post')).toHaveLength(1);
	expect(catalog.adapter.query('SELECT id FROM catalog_entities')).toHaveLength(2);
});

test('incompatible catalog schemas are refused without relabeling their version', () => {
	catalog.replace(catalogFixture().index, catalogFixture().snapshots);
	catalog.adapter.execute('UPDATE catalog_metadata SET schema_version=2');
	expect(() => new CatalogRepository(db)).toThrow('Unsupported SQLite catalog schema version');
	expect(catalog.adapter.query('SELECT schema_version FROM catalog_metadata')).toEqual([
		{ schema_version: 2 }
	]);
});

test('verification gaps and scenario summaries keep their original commit and validity', () => {
	const { index, snapshots } = catalogFixture();
	const record = {
		id: 'record-one',
		status: 'failed' as const,
		profile: 'fixture',
		finishedAt: '2026-10-20T12:00:00Z',
		base: firstCommit,
		valid: false,
		problems: ['missing evidence']
	};
	index.revisions[0].records = [record];
	const scenario = {
		id: 'model-crud',
		title: 'Model CRUD',
		kind: 'headless',
		units: ['model.post'],
		states: [{ id: 'persisted', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'crud', kind: 'integration', runner: 'vitest' }],
		evidence: []
	};
	snapshots[1].registry.scenarios = [scenario];
	catalog.replace(index, snapshots);
	expect(catalog.records()).toEqual([record]);
	expect(catalog.records(firstCommit)).toEqual([]);
	expect(catalog.scenarios()).toEqual([scenario]);
	expect(catalog.scenarios(firstCommit)).toEqual([]);
});

test('revisions preserve budget metadata even when the entity source version is unchanged', () => {
	const { index, snapshots } = catalogFixture();
	snapshots[1].registry.units[0].emitted = { limits: { module: 123 } };
	catalog.replace(index, snapshots);
	expect(catalog.entities({ commit: secondCommit, kind: 'model' })[0].emitted).toEqual({
		limits: { module: 123 }
	});
	expect(catalog.entities({ commit: firstCommit, kind: 'model' })[0].emitted).toBeUndefined();
});
