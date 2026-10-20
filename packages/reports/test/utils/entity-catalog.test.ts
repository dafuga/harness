import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { catalogFilter } from '../../src/components/harness/explorer-index/entityCatalog';
import { entityCatalog, listed } from '../../src/utils/entityCatalog';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { explorerRelations } from '../../src/utils/explorerRelations';
import { record, revision } from '../entityFixture';
import { commits, ids } from '../entityUnits';

const head = revision(commits.middle, [record(commits.middle)]);
// The same commit with the empty state of the page never captured.
const partial = revision(commits.middle, [record(commits.middle, false)]);
const rows = (category: Parameters<typeof entityCatalog>[1], detail = head) =>
	entityCatalog(explorerEntities(detail), category, (id) => explorerRelations(detail, id));
const consumers = explorerEntities(head).filter((entity) => entity.category !== 'functions');
const filter = { search: '', changedOnly: false, order: 'name' as const };

test.each([
	{
		entry: '../../src/utils/entityCatalog.ts',
		exports: ['catalogFilter', 'entityCatalog', 'isShared', 'listed']
	},
	{
		entry: '../../src/components/harness/explorer-index/entityCatalog.ts',
		exports: ['catalogFilter']
	}
])('a fresh runtime loads and calls the catalog through $entry', ({ entry, exports }) => {
	const path = fileURLToPath(new URL(entry, import.meta.url));
	const script = `const m = await import(${JSON.stringify(path)}); console.log(JSON.stringify({ types: ${JSON.stringify(exports)}.map(name => typeof m[name]), rows: m.catalogFilter([], { search: '', changedOnly: false, order: 'name' }) }));`;
	const output = execFileSync(process.env.HARNESS_BUN_PATH ?? 'bun', ['-e', script], {
		encoding: 'utf8',
		timeout: 10000
	});
	expect(JSON.parse(output)).toEqual({ types: exports.map(() => 'function'), rows: [] });
});

test('a collection lists the entities of its category by the name a person reads', () => {
	expect(rows('components').map((row) => row.name)).toEqual([
		'Order card',
		'Order list',
		'Search box'
	]);
	expect(rows('pages').map((row) => row.id)).toEqual([ids.page]);
	const original = explorerEntities(head).find((entity) => entity.id === ids.filter)!;
	const functions = ['zebra', 'Alpha', 'beta'].map((name, index) => ({
		...original,
		id: name,
		name: ['A title', 'Z title', 'M title'][index],
		unit: {
			...original.unit,
			helpers: [
				{
					name,
					pure: true,
					source: 'src/utils/shared.ts',
					inputs: [],
					consumers: original.unit.helpers![0].consumers
				}
			],
			contract: { ...original.unit.contract, inputs: [{ name: `${name}.value`, type: 'string' }] }
		}
	}));
	const sorted = entityCatalog([...functions, ...consumers], 'functions', () =>
		explorerRelations(head, ids.filter)
	);
	expect(
		sorted.map((row) => row.id),
		'default order follows the displayed function name'
	).toEqual(['Alpha', 'beta', 'zebra']);
	expect(catalogFilter(sorted, { ...filter, order: 'name-desc' }).map((row) => row.id)).toEqual([
		'zebra',
		'beta',
		'Alpha'
	]);
	expect(
		catalogFilter(sorted, { ...filter, search: 'Z title' }).map((row) => row.id),
		'owner names remain searchable when cards show callable names'
	).toEqual(['Alpha']);
	const shown = rows('components').map(({ entity: _entity, ...row }) => row);
	expect(JSON.stringify(shown)).not.toMatch(/src\/|\.ts"|OrderList/);
});

test('a component says which pages it is used on and which components it contains', () => {
	const card = rows('components').find((row) => row.id === ids.card)!;
	expect(card.usedOn).toEqual(['Orders page']);
	expect(card.usedBy).toEqual(['Order list']);
	const list = rows('components').find((row) => row.id === ids.list)!;
	expect(list.contains).toEqual(['Order card']);
	expect(list.shared).toBe(false);
});

test('a page counts the components it contains and a service names its targets', () => {
	expect(rows('pages')[0].components).toBe(2);
	expect(rows('services')[0].targets).toEqual(['module', 'wasm', 'process']);
	const service = rows('services')[0];
	expect(service.name).toBe('OrderStore');
	expect(service.usedIn).toEqual([{ id: ids.list, name: 'Order list', category: 'components' }]);
	for (const search of ['OrderStore', 'Order store']) {
		expect(catalogFilter([service], { ...filter, search }).map((row) => row.id)).toEqual([
			ids.store
		]);
	}
	const original = service.entity;
	const unnamed = { ...original, unit: { ...original.unit, owns: { source: [], symbols: [] } } };
	const related = explorerRelations(head, ids.store);
	const fallback = entityCatalog([unnamed], 'services', () => ({ ...related, usedBy: [] }))[0];
	expect(fallback.name).toBe('Order store');
	expect(fallback.usedIn).toEqual([{ id: ids.page, name: 'Orders page', category: 'pages' }]);
	expect(
		entityCatalog([unnamed], 'services', () => ({ ...related, usedBy: [], pages: [] }))[0].usedIn
	).toEqual([]);
});

test('changed is what the commit changed itself, and the verdict is the one it was given', () => {
	expect(rows('functions')[0].changed).toBe(true);
	expect(rows('configs')[0].changed).toBe(false);
	// The page is only affected through what it uses; that is not a change of the page.
	expect(rows('pages')[0].changed).toBe(false);
	expect(rows('pages')[0].verdict).toEqual({
		passed: true,
		label: 'Full coverage passed',
		reasons: []
	});
	const failed = rows('pages', partial)[0].verdict;
	expect(failed.passed).toBe(false);
	expect(failed.label).not.toMatch(/%|\d/);
	expect(failed.reasons.join(' ')).toContain('empty');
});

test('search reads names and purposes, changed only keeps changes, and an order sorts', () => {
	const all = rows('components');
	const names = (found: typeof all) => found.map((row) => row.name);
	expect(names(catalogFilter(all, { ...filter, search: 'SEARCH' }))).toEqual([
		'Order list',
		'Search box'
	]);
	expect(names(catalogFilter(all, { ...filter, changedOnly: true }))).toEqual(['Order list']);
	expect(catalogFilter(all, { ...filter, order: 'name-desc' })[0].name).toBe('Search box');
	expect(catalogFilter(all, { ...filter, order: 'changed' })[0].name).toBe('Order list');
	const failing = [...rows('functions', partial), ...rows('pages', partial)];
	expect(catalogFilter(failing, { ...filter, order: 'failed' })[0].name).toBe('Orders page');
	expect(catalogFilter(all, { ...filter, search: 'nothing-matches' })).toEqual([]);
	expect(
		catalogFilter(rows('functions'), { ...filter, search: ' FILTERORDERS ' }).map((row) => row.id),
		'visible function symbols are searchable'
	).toEqual([ids.filter]);
	// Filtering leaves the rows it was given as they were.
	expect(names(all)).toEqual(['Order card', 'Order list', 'Search box']);
});

test('a list of names is none, one name, or the first and how many more', () => {
	expect(listed([])).toBe('none');
	expect(listed(['Order list'])).toBe('Order list');
	expect(listed(['Order list', 'Search box', 'Order card'])).toBe('Order list + 2 more');
	expect(listed(['Order card', 'Search box'], 2)).toBe('Order card · Search box');
});

test('shared helper rows require source exports, list every callable and keep owner links', () => {
	const original = explorerEntities(head).find((entity) => entity.id === ids.filter)!;
	const helpers = ['second', 'first'].map((name) => ({
		name,
		pure: true,
		source: 'src/utils/shared.ts',
		inputs: [],
		consumers: [{ unit: ids.list }, { unit: ids.store }]
	}));
	const variants = [
		{ ...original, unit: { ...original.unit, helpers } },
		{
			...original,
			id: 'single',
			unit: {
				...original.unit,
				helpers: [
					{ ...helpers[0], name: 'single', consumers: [{ unit: ids.list }, { unit: ids.list }] }
				]
			}
		},
		{
			...original,
			id: 'effectful',
			unit: { ...original.unit, helpers: [{ ...helpers[0], name: 'loadData', pure: false }] }
		},
		{
			...original,
			id: 'unknown',
			unit: { ...original.unit, helpers: [{ ...helpers[0], name: 'unknown', pure: undefined }] }
		},
		{ ...original, id: 'types', unit: { ...original.unit, helpers: [] } },
		{ ...original, id: 'legacy', unit: { ...original.unit, helpers: undefined } }
	];
	const shown = entityCatalog([...variants, ...consumers], 'functions', () => ({
		pages: [],
		usedBy: [],
		components: [],
		uses: []
	}));
	expect(
		shown.map((row) => row.name),
		'only exported shared helpers are listed'
	).toEqual(['first', 'second']);
	expect(new Set(shown.map((row) => row.id)).size).toBe(2);
	expect(shown.every((row) => row.entity.id === ids.filter)).toBe(true);
	expect(
		shown.every((row) => row.shared),
		'sharing requires two distinct proven consumers'
	).toBe(true);
	expect(catalogFilter(shown, { ...filter, search: 'second' }).map((row) => row.name)).toEqual([
		'second'
	]);
});
