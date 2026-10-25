import { expect, test } from 'vitest';
import { catalogFilter } from '../../src/components/explorer-ui/explorer-index/entityCatalog';
import { entityCatalog, listed } from '../../src/utils/entityCatalog';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { explorerRelations } from '../../src/utils/explorerRelations';
import { record, revision } from '../entityFixture';
import { privateServiceUsers } from '../entityPreviewHelpers';
import { invalidServiceClasses, serviceMetadata, admission } from '../entityClassFixtures';
import { commits, ids } from '../entityUnits';
import { assertApiCatalog } from '../entityApiCatalog';
const head = revision(commits.middle, [record(commits.middle)]);
const partial = revision(commits.middle, [record(commits.middle, false)]);
const rows = (category: Parameters<typeof entityCatalog>[1], detail = head) =>
	entityCatalog(explorerEntities(detail), category, (id) => explorerRelations(detail, id));
const consumers = explorerEntities(head).filter((entity) => entity.category !== 'functions');
const filter = { search: '', changedOnly: false, order: 'name' as const };
test('a collection lists the entities of its category by the name a person reads', () => {
	expect(rows('components').map((row) => row.name)).toEqual([
		'OrderCard',
		'OrderList',
		'SearchBox'
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
	const shown = rows('components').map(({ entity: _entity, usedIn: _consumers, ...row }) => row);
	expect(JSON.stringify(shown)).not.toMatch(/src\/|\.ts"/);
});
test('a component says which pages it is used on and which components it contains', () => {
	const card = rows('components').find((row) => row.id === ids.card)!;
	expect(card.usedOn).toEqual(['Orders page']);
	expect(card.usedBy).toEqual(['OrderList']);
	expect(card.usedIn?.map((item) => item.id)).toEqual([ids.list, ids.page]);
	expect(card.usedIn?.every((item) => item.unit.id === item.id)).toBe(true);
	const list = rows('components').find((row) => row.id === ids.list)!;
	expect(list.contains).toEqual(['OrderCard']);
	expect(list.shared).toBe(false);
});
test('service rows require two distinct resolved runtime owners and use that set for links', () => {
	expect(rows('pages')[0].components).toBe(2);
	const service = rows('services')[0];
	expect(service.targets).toEqual(['module', 'wasm', 'process']);
	expect(service.name).toBe('OrderStore');
	expect(service.usedIn?.map(({ id, name, category }) => ({ id, name, category }))).toEqual([
		{ id: ids.list, name: 'OrderList', category: 'components' },
		{ id: ids.search, name: 'SearchBox', category: 'components' }
	]);
	for (const search of ['OrderStore', 'Order store'])
		expect(catalogFilter([service], { ...filter, search }).map((row) => row.id)).toEqual([
			ids.store
		]);
	const original = service.entity;
	const related = explorerRelations(head, ids.store);
	const known = explorerEntities(head);
	const serviceRows = (entity: typeof original) =>
		entityCatalog(
			known.map((item) => (item.id === original.id ? entity : item)),
			'services',
			() => related
		);
	for (const consumers of privateServiceUsers)
		expect(
			serviceRows({ ...original, unit: { ...original.unit, ...serviceMetadata(consumers) } }),
			'transitive pages and imports cannot establish sharing'
		).toEqual([]);
	expect(admission(entityCatalog, known, () => related)).toEqual([]);
	const proof = serviceMetadata([{ unit: ids.list }, { unit: ids.search }]).serviceClasses[0];
	for (const serviceClasses of invalidServiceClasses(proof))
		expect(
			serviceRows({ ...original, unit: { ...original.unit, ...{ serviceClasses } } }),
			'functions, objects, static namespaces, unused classes and unproven history are not class cards'
		).toEqual([]);
	const unnamed = { ...original, unit: { ...original.unit, owns: { source: [], symbols: [] } } };
	expect(serviceRows(unnamed), 'unowned source cannot prove a class').toEqual([]);
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
		'OrderList',
		'SearchBox'
	]);
	expect(names(catalogFilter(all, { ...filter, changedOnly: true }))).toEqual(['OrderList']);
	expect(catalogFilter(all, { ...filter, order: 'name-desc' })[0].name).toBe('SearchBox');
	expect(catalogFilter(all, { ...filter, order: 'changed' })[0].name).toBe('OrderList');
	const failing = [...rows('functions', partial), ...rows('pages', partial)];
	expect(catalogFilter(failing, { ...filter, order: 'failed' })[0].name).toBe('Orders page');
	expect(catalogFilter(all, { ...filter, search: 'nothing-matches' })).toEqual([]);
	expect(
		catalogFilter(rows('functions'), { ...filter, search: ' FILTERORDERS ' }).map((row) => row.id),
		'visible function symbols are searchable'
	).toEqual([ids.filter]);
	expect(names(all)).toEqual(['OrderCard', 'OrderList', 'SearchBox']);
});
test('a list of names is none, one name, or the first and how many more', () => {
	expect(listed([])).toBe('none');
	expect(listed(['OrderList'])).toBe('OrderList');
	expect(listed(['OrderList', 'SearchBox', 'OrderCard'])).toBe('OrderList + 2 more');
	expect(listed(['OrderCard', 'SearchBox'], 2)).toBe('OrderCard · SearchBox');
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
	const allShared = shown.every((row) => row.shared);
	expect(allShared, 'sharing requires two distinct proven consumers').toBe(true);
	expect(catalogFilter(shown, { ...filter, search: 'second' }).map((row) => row.name)).toEqual([
		'second'
	]);
});

test('APIs list endpoints and revision-scoped transitive usage', assertApiCatalog);
