import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityUsage, usageGroups, usageIdentity } from '../../src/utils/explorer-ui/entityUsage';
import type {
	ExplorerEntity,
	ExplorerRelations
} from '../../src/models/explorer-ui/Explorer.types';

const unitId = 'reports.function.entity-usage';
type Cases = Parameters<typeof recordExampleCases>[1];
const record = (symbol: string, state: string, cases: Cases) => {
	const file = `${state}.json`;
	return recordExampleCases({ unitId, symbol, state, evidence: 'examples-cases', file }, cases);
};

const entity = (id: string, category: string) => ({ id, category }) as ExplorerEntity;
const support = (id: string) =>
	({ id, role: 'Model', name: id }) as ExplorerRelations['support'][number];
const none: ExplorerRelations = {
	pages: [],
	layouts: [],
	components: [],
	functions: [],
	configs: [],
	services: [],
	usedBy: [],
	support: []
};
const ids = (items: { id: string }[]) => items.map((item) => item.id);
const titled = (groups: { title: string; items: { id: string }[] }[]) =>
	groups.map((group) => [group.title, ids(group.items)]);

const relations: ExplorerRelations = {
	...none,
	pages: [entity('page.a', 'pages'), entity('page.b', 'pages')],
	usedBy: [
		entity('component.c', 'components'),
		entity('page.a', 'pages'),
		entity('component.c', 'components')
	],
	apis: [entity('api.x', 'apis')],
	functions: [entity('function.f', 'functions'), entity('function.f', 'functions')],
	services: [entity('service.s', 'services')],
	support: [support('model.m'), support('model.m')]
};

test('Used-by rows list pages first with each user once, and uses rows keep their kinds', () => {
	const usage = entityUsage(relations);
	expect(ids(usage.usedIn)).toEqual(['page.a', 'page.b', 'component.c']);
	expect(titled(usage.usedInGroups)).toEqual([
		['Pages', ['page.a', 'page.b']],
		['Components', ['component.c']]
	]);
	expect(titled(usage.uses)).toEqual([
		['APIs', ['api.x']],
		['Functions', ['function.f']],
		['Services', ['service.s']]
	]);
	expect([ids(usage.other), usage.count]).toEqual([['model.m'], 4]);
	record('entityUsage', 'usage-rows-pages-first-and-kinds', [
		{ name: 'pages, usedBy, kinds and support with repeats', input: { relations }, output: usage }
	]);
});

test('Missing evidence reads as empty rows, including a kind list that is absent', () => {
	const empty = entityUsage(none);
	expect([empty.usedIn, empty.usedInGroups, empty.uses, empty.other, empty.count]).toEqual([
		[],
		[],
		[],
		[],
		0
	]);
	const absent: ExplorerRelations = { ...none, functions: [entity('function.f', 'functions')] };
	delete (absent as Partial<ExplorerRelations>).services;
	const partial = entityUsage(absent);
	expect(titled(partial.uses)).toEqual([['Functions', ['function.f']]]);
	expect(partial.count).toBe(1);
	record('entityUsage', 'missing-evidence-reads-empty', [
		{ name: 'no relations at all', input: { relations: 'none' }, output: empty },
		{
			name: 'services list absent, functions kept',
			input: { relations: 'partial' },
			output: partial
		}
	]);
});

test('Groups keep the nine kinds in order, each id once, and leave out other categories', () => {
	const items = [
		entity('page.a', 'pages'),
		entity('component.c', 'components'),
		entity('component.c', 'components'),
		entity('platform.p', 'platforms'),
		entity('function.f', 'functions'),
		entity('component.d', 'components')
	];
	const groups = usageGroups(items);
	expect(titled(groups)).toEqual([
		['Pages', ['page.a']],
		['Components', ['component.c', 'component.d']],
		['Functions', ['function.f']]
	]);
	expect(usageGroups([])).toEqual([]);
	record('usageGroups', 'groups-keep-nine-kinds-once', [
		{
			name: 'repeats once, platforms left out, navigation order',
			input: { items },
			output: groups
		},
		{ name: 'no consumers gives no groups', input: { items: [] }, output: [] }
	]);
});

test('A usage identity is the unit id, then # and its caller symbol when it has a caller', () => {
	const withSymbol = {
		...entity('page.a', 'pages'),
		caller: { symbol: 'load', sourceOnly: false }
	};
	const emptySymbol = { ...entity('page.a', 'pages'), caller: { symbol: '', sourceOnly: true } };
	const plain = entity('page.a', 'pages');
	const identities = [withSymbol, emptySymbol, plain].map((item) => usageIdentity(item));
	expect(identities).toEqual(['page.a#load', 'page.a#', 'page.a']);
	record('usageIdentity', 'usage-identity-stable-labels', [
		{ name: 'caller with a symbol', input: { entity: withSymbol }, output: identities[0] },
		{
			name: 'caller with an empty symbol keeps the hash',
			input: { entity: emptySymbol },
			output: identities[1]
		},
		{
			name: 'no caller entry is the unit id alone',
			input: { entity: plain },
			output: identities[2]
		}
	]);
});
