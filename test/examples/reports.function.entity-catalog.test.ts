import { test } from 'vitest';
import {
	catalogFilter,
	entityCatalog
} from '../../packages/reports/src/utils/explorer-ui/entityCatalog';
import { explorerEntities } from '../../packages/reports/src/utils/explorer-ui/explorerEntities';
import { explorerRelations } from '../../packages/reports/src/utils/explorer-ui/explorerRelations';
import { record, revision } from '../../packages/reports/test/entityFixture';
import { commits, ids } from '../../packages/reports/test/entityUnits';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

type Category = Parameters<typeof entityCatalog>[1];
type Options = Parameters<typeof entityCatalog>[3];
type Entity = ReturnType<typeof explorerEntities>[number];
type Row = ReturnType<typeof entityCatalog>[number];

const head = revision(commits.middle, [record(commits.middle)]);
const entities = explorerEntities(head);
const relations = (id: string) => explorerRelations(head, id);
const rows = (category: Category, options?: Options, list = entities) =>
	entityCatalog(list, category, relations, options);
const names = (found: Row[]) => found.map((row) => row.name);
const filter = { search: '', changedOnly: false, order: 'name' as const };

/** Entities of one category with their units replaced, so one admission rule is tested alone. */
const withUnits = (category: Category, change: (unit: Entity['unit']) => Entity['unit']) =>
	entities.map((entity) =>
		entity.category === category ? { ...entity, unit: change(entity.unit) } : entity
	);
// The service has one owner: the single-owner variant under test.
const singleOwner = entities.map((entity) =>
	entity.id === ids.store
		? {
				...entity,
				unit: {
					...entity.unit,
					serviceClasses: entity.unit.serviceClasses?.map((item) => ({
						...item,
						consumers: [{ unit: ids.list }]
					}))
				}
			}
		: entity
);
// The helper is called twice by one consumer, which is not two distinct consumers.
const oneConsumer = withUnits('functions', (unit) => ({
	...unit,
	helpers: unit.helpers?.map((helper) => ({
		...helper,
		consumers: [{ unit: ids.list }, { unit: ids.list }]
	}))
}));
const wrongKind = withUnits('configs', (unit) => ({ ...unit, kind: 'page' }));

/** Records one named symbol's cases as a trace of their inputs and results. */
function traceCases(
	symbol: string,
	state: string,
	list: Array<[name: string, input: unknown, output: unknown]>
): boolean {
	const cases = list.map(([name, input, output]) => ({ name, input, output }));
	return recordExampleCases(
		{
			unitId: 'reports.function.entity-catalog',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const groupState = 'entity-catalog-groups-by-name-and-shared-owners';
test('collections list entities by name and admit only shared owners by default', () => {
	const found = {
		components: names(rows('components')),
		pages: names(rows('pages')),
		services: names(rows('services')),
		functions: names(rows('functions')),
		configs: names(rows('configs')),
		apis: names(rows('apis'))
	};
	expect(found.components).toEqual(['OrderCard', 'OrderList', 'SearchBox']);
	expect(found.pages).toEqual(['Orders page']);
	expect(found.services).toEqual(['OrderStore']);
	expect(found.functions).toEqual(['filterOrders']);
	expect(found.configs).toHaveLength(17);
	expect(found.apis).toEqual([]);
	traceCases('entityCatalog', groupState, [
		['components by name', { category: 'components' }, found.components],
		['pages list one page', { category: 'pages' }, found.pages],
		['services need two owners', { category: 'services' }, found.services],
		['functions need two consumers', { category: 'functions' }, found.functions],
		['configs one row per variable', { category: 'configs' }, found.configs],
		['apis empty without endpoints', { category: 'apis' }, found.apis]
	]);
});

const relatedState = 'entity-catalog-related-single-owner-pure-callees-and-kinds';
test('related relationships admit one owner, keep pure callees and only compatible kinds', () => {
	const found = {
		serviceDefault: names(rows('services', undefined, singleOwner)),
		serviceRelated: names(rows('services', { related: true }, singleOwner)),
		functionDefault: names(rows('functions', undefined, oneConsumer)),
		functionRelated: names(rows('functions', { related: true }, oneConsumer)),
		configRelated: names(rows('configs', { related: true })),
		configWrongKind: names(rows('configs', undefined, wrongKind))
	};
	expect(found.serviceDefault, 'a public service needs two owners').toEqual([]);
	expect(found.serviceRelated, 'a related service keeps its one owner').toEqual(['OrderStore']);
	expect(found.functionDefault, 'a single-consumer helper is not shared').toEqual([]);
	expect(found.functionRelated, 'a related function keeps its pure callee').toEqual([
		'filterOrders'
	]);
	expect(found.configRelated, 'related configs list one row per module').toEqual(['orderSettings']);
	expect(found.configWrongKind, 'only config units are config rows').toEqual([]);
	traceCases('entityCatalog', relatedState, [
		['single owner service absent', { category: 'services' }, found.serviceDefault],
		['related single owner kept', { category: 'services', related: true }, found.serviceRelated],
		['one consumer helper absent', { category: 'functions' }, found.functionDefault],
		['related pure callee kept', { category: 'functions', related: true }, found.functionRelated],
		['related configs one per module', { category: 'configs', related: true }, found.configRelated],
		['non-config unit yields no rows', { category: 'configs', kind: 'page' }, found.configWrongKind]
	]);
});

const filterState = 'entity-catalog-filter-search-usage-changed-and-order';
test('a consumer filter narrows rows by search, usage and changes, then orders them', () => {
	const components = rows('components');
	const before = names(components);
	const found = {
		shared: names(
			catalogFilter([...rows('functions'), ...components], {
				...filter,
				search: 'filter orders',
				usage: 'shared'
			})
		),
		search: names(catalogFilter(components, { ...filter, search: 'SEARCH' })),
		changed: names(catalogFilter(components, { ...filter, changedOnly: true })),
		group: names(catalogFilter(components, { ...filter, groups: ['uncategorized'] })),
		changedFirst: names(catalogFilter(components, { ...filter, order: 'changed' })),
		reversed: names(catalogFilter(components, { ...filter, order: 'name-desc' }))
	};
	expect(found.shared).toEqual(['filterOrders']);
	expect(found.search).toEqual(['OrderList', 'SearchBox']);
	expect(found.changed).toEqual(['OrderList']);
	expect(found.group, 'rows without a group belong to uncategorized').toEqual(before);
	expect(found.changedFirst).toEqual(['OrderList', 'OrderCard', 'SearchBox']);
	expect(found.reversed).toEqual(['SearchBox', 'OrderList', 'OrderCard']);
	expect(names(components), 'the input array is not reordered').toEqual(before);
	traceCases('catalogFilter', filterState, [
		['shared camel-case search', { search: 'filter orders' }, found.shared],
		['search ignores case', { search: 'SEARCH' }, found.search],
		['changed only', { changedOnly: true }, found.changed],
		['uncategorized group', { groups: ['uncategorized'] }, found.group],
		['changed order', { order: 'changed' }, found.changedFirst],
		['name descending', { order: 'name-desc' }, found.reversed]
	]);
});

const absentState = 'entity-catalog-filter-absent-and-unmatched-queries';
test('unmatched queries, unshared usage, unknown verification and empty input give no rows', () => {
	const components = rows('components');
	const found = {
		unmatched: names(catalogFilter(components, { ...filter, search: 'nothing-matches' })),
		unshared: names(catalogFilter(components, { ...filter, usage: 'shared' })),
		unknownVerification: names(catalogFilter(components, { ...filter, verification: 'unknown' })),
		unchangedPages: names(catalogFilter(rows('pages'), { ...filter, changedOnly: true })),
		emptyInput: names(catalogFilter([], filter)),
		missingGroup: names(catalogFilter(components, { ...filter, groups: ['billing'] }))
	};
	expect(found).toEqual({
		unmatched: [],
		unshared: [],
		unknownVerification: [],
		unchangedPages: [],
		emptyInput: [],
		missingGroup: []
	});
	traceCases('catalogFilter', absentState, [
		['no entity matches', { search: 'nothing-matches' }, found.unmatched],
		['no shared component', { usage: 'shared' }, found.unshared],
		['unknown verification', { verification: 'unknown' }, found.unknownVerification],
		['unchanged pages', { changedOnly: true, category: 'pages' }, found.unchangedPages],
		['empty input', { rows: [] }, found.emptyInput],
		['unknown group', { groups: ['billing'] }, found.missingGroup]
	]);
});
