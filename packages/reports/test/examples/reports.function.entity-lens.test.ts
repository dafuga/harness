import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { entityLabels, entityLens, shortCommit } from '../../src/utils/explorer-ui/entityLens';
import type { ExplorerLocation } from '../../src/models/explorer-ui/Explorer.types';
import type { Cases } from './reports.function.entity-lens.test.types';
const unitId = 'reports.function.entity-lens';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const commitA = '8b41d0720e252681deac809969b3faf8181dac30';
const commitB = '3f9c2a180ce54b0df3f6cadf02d1192568f6d7c6';
const branch = 'feature/orders';
const from = (changed: Partial<ExplorerLocation> = {}): ExplorerLocation => ({
	branch,
	commit: commitA,
	category: 'pages',
	...changed
});

test('Commit text is cut to its first seven characters, and shorter text is unchanged', () => {
	const cases = [
		{ name: 'full commit hash', input: commitA, output: shortCommit(commitA) },
		{ name: 'exactly seven characters', input: '1234567', output: shortCommit('1234567') },
		{ name: 'short text', input: 'abc', output: shortCommit('abc') },
		{ name: 'empty text', input: '', output: shortCommit('') },
		{ name: 'text that is not a hash', input: 'not-a-hash', output: shortCommit('not-a-hash') }
	];
	expect(cases.map((item) => item.output)).toEqual(['8b41d07', '1234567', 'abc', '', 'not-a-h']);
	record('shortCommit', 'shortcommit-keeps-seven-characters', cases);
});

test('The ten collections keep Pages first, each with its fixed title and subtitle', () => {
	const keys = Object.keys(entityLabels);
	expect(keys).toEqual([
		'pages',
		'apis',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models',
		'types',
		'platforms'
	]);
	expect(entityLabels.functions).toEqual({
		title: 'Helpers',
		one: 'Helper',
		subtitle: 'Pure, reusable functions. Same inputs, same result; no side effects.'
	});
	record('entityLabels', 'entity-labels-keep-pages-first', [
		{ name: 'collection keys in order', input: 'entityLabels', output: keys },
		{ name: 'helpers label', input: 'functions', output: entityLabels.functions }
	]);
});

test('A link keeps the branch and the commit it starts from unless it names its own', () => {
	const start = from({ entity: 'app.page.orders', section: 'history' });
	const kept = entityLens(start, { category: 'components', entity: 'app.component.order-list' });
	const named = entityLens(start, { commit: commitB, entity: 'app.page.orders' });
	const tip = entityLens(from({ commit: null }), { entity: 'app.page.orders' });
	const detached = entityLens(from({ branch: null }), { category: 'configs' });
	expect(kept).toEqual({
		branch,
		commit: commitA,
		category: 'components',
		entity: 'app.component.order-list'
	});
	expect(named.commit).toBe(commitB);
	expect(tip.commit).toBeNull();
	expect(detached.branch).toBeNull();
	record('entityLens', 'link-keeps-branch-and-commit', [
		{ name: 'category and entity from the link', input: 'to category and entity', output: kept },
		{ name: 'link names a commit', input: 'to commit', output: named },
		{ name: 'branch tip stays at the tip', input: 'from commit null', output: tip },
		{ name: 'no branch is invented', input: 'from branch null', output: detached }
	]);
});

test('A link never carries a section or tab from where it starts', () => {
	const start = from({ entity: 'app.page.orders', section: 'history', tab: 'source' });
	const other = entityLens(start, { entity: 'app.component.order-list' });
	const same = entityLens(start, { entity: 'app.page.orders' });
	const own = entityLens(start, { entity: 'app.page.orders', section: 'details', tab: 'tests' });
	const collection = entityLens(start, { category: 'services' });
	expect(other).not.toHaveProperty('section');
	expect(other).not.toHaveProperty('tab');
	expect(same).not.toHaveProperty('section');
	expect(same).not.toHaveProperty('tab');
	expect(own.section).toBe('details');
	expect(own.tab).toBe('tests');
	expect(collection).not.toHaveProperty('entity');
	record('entityLens', 'link-never-carries-section-or-tab', [
		{ name: 'other entity drops section and tab', input: 'to another entity', output: other },
		{ name: 'same entity drops section and tab', input: 'to the same entity', output: same },
		{ name: 'link names its own section and tab', input: 'to section and tab', output: own },
		{ name: 'collection keeps no entity', input: 'to category only', output: collection }
	]);
});

test('A helper is carried only into the functions category for the same entity', () => {
	const helper = from({
		category: 'functions',
		entity: 'app.function.filter-orders',
		helper: 'filterOrders'
	});
	const sameEntity = entityLens(helper, { entity: 'app.function.filter-orders', tab: 'contract' });
	const otherEntity = entityLens(helper, { entity: 'app.page.orders' });
	const namedHelper = entityLens(helper, {
		entity: 'app.function.filter-orders',
		helper: 'sortOrders'
	});
	const pages = entityLens(from({ entity: 'app.page.orders', helper: 'filterOrders' }), {
		entity: 'app.page.orders'
	});
	expect(sameEntity).toHaveProperty('helper', 'filterOrders');
	expect(otherEntity).not.toHaveProperty('helper');
	expect(namedHelper).toHaveProperty('helper', 'sortOrders');
	expect(pages).not.toHaveProperty('helper');
	record('entityLens', 'helper-only-for-same-entity-in-functions', [
		{ name: 'same entity keeps the helper', input: 'to the same function', output: sameEntity },
		{ name: 'other entity drops the helper', input: 'to another entity', output: otherEntity },
		{ name: 'link names its own helper', input: 'to helper sortOrders', output: namedHelper },
		{
			name: 'pages category never keeps a helper',
			input: 'from pages with a helper',
			output: pages
		}
	]);
});
