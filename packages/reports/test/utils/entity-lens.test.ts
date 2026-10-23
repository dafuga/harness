import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { entityLabels, entityLens } from '../../src/utils/entityLens';
import { place } from '../entityPlaces';
import { commits, ids } from '../entityUnits';

test('there are exactly seven collections and pages come first', () =>
	measureWorkload('reports.function.entity-lens', 'layout-catalog-behavior', () => {
		expect(Object.keys(entityLabels)).toEqual([
			'pages',
			'layouts',
			'components',
			'functions',
			'configs',
			'services',
			'models',
			'types',
			'platforms'
		]);
		const words = Object.values(entityLabels).flatMap((label) => [label.title, label.subtitle]);
		expect(words.join(' ')).not.toMatch(/sub-?components|related|reports/i);
	}));

test('a link keeps the branch and the selected commit it is shown under', () =>
	measureWorkload('reports.function.entity-lens', 'layout-catalog-behavior', () => {
		const from = place({ entity: ids.page, tab: 'tests' });
		expect(entityLens(from, { category: 'components', entity: ids.list })).toEqual({
			branch: 'feature/orders',
			commit: commits.middle,
			category: 'components',
			entity: ids.list
		});
	}));

test('a link from the branch tip stays at the branch tip', () => {
	const to = entityLens(place({ commit: null }), { entity: ids.page, section: 'details' });
	expect(to.commit).toBeNull();
	expect(to.section).toBe('details');
	expect(entityLens(to, { entity: ids.page, section: 'details', tab: 'source' }).tab).toBe(
		'source'
	);
});

test('only a link that names a commit leaves the revision, and a collection keeps no entity', () => {
	const from = place({ commit: null, entity: ids.page, section: 'history' });
	expect(entityLens(from, { commit: commits.first, entity: ids.page }).commit).toBe(commits.first);
	expect(entityLens(from, { category: 'services' })).toEqual({
		branch: 'feature/orders',
		commit: null,
		category: 'services'
	});
	// The overview is the address without a section, so two links to it are the same address.
	expect(entityLens(from, { entity: ids.page })).not.toHaveProperty('section');
	// A commit on no branch keeps having none; no branch is invented for a link.
	expect(entityLens(place({ branch: null }), { category: 'configs' }).branch).toBeNull();
});

test('callable identity follows its own tabs and commits, never another entity', () => {
	const from = { ...place({ category: 'functions', entity: ids.filter }), helper: 'filterOrders' };
	expect(entityLens(from, { entity: ids.filter, tab: 'contract' })).toHaveProperty(
		'helper',
		'filterOrders'
	);
	expect(
		entityLens(from, { entity: ids.filter, section: 'history', commit: commits.first })
	).toHaveProperty('helper', 'filterOrders');
	expect(entityLens(from, { entity: ids.list })).not.toHaveProperty('helper');
	expect(entityLens(from, { category: 'functions' })).not.toHaveProperty('helper');
});
