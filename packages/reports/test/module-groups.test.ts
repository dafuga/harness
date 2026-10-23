import { categorySources } from './entityPreviewGroups';
import { expect, test } from 'vitest';
import { entityCatalog, catalogFilter } from '../src/utils/entityCatalog';
import { explorerEntities } from '../src/utils/explorerEntities';
import { explorerRelations } from '../src/utils/explorerRelations';
import { record, revision } from './entityFixture';
import { commits, ids } from './entityUnits';

const head = revision(commits.middle, [record(commits.middle)]);
const entities = explorerEntities(head).map((entity) => ({
	...entity,
	unit: {
		...entity.unit,
		group:
			entity.id === ids.search
				? { id: 'inputs', title: 'Inputs' }
				: { id: 'orders', title: 'Orders' }
	}
}));
const rows = (category: Parameters<typeof entityCatalog>[1]) =>
	entityCatalog(entities, category, (id) => explorerRelations(head, id));
const filter = { search: '', changedOnly: false, order: 'name' as const };

test('catalog categories survive across kinds and combine with other filters', () => {
	for (const category of ['pages', 'components', 'functions', 'services', 'configs'] as const) {
		expect(rows(category)[0]).toHaveProperty('group', { id: 'orders', title: 'Orders' });
	}
	const components = rows('components');
	const selected = { ...filter, groups: ['inputs'] };
	expect(catalogFilter(components, selected).map((row) => row.name)).toEqual(['SearchBox']);
	expect(catalogFilter(components, { ...selected, search: 'card' })).toEqual([]);
	expect(catalogFilter(components, { ...selected, changedOnly: true })).toEqual([]);
	expect(catalogFilter(components, { ...filter, groups: ['orders', 'inputs'] })).toHaveLength(3);
	expect(catalogFilter(components, { ...filter, groups: ['missing'] })).toEqual([]);
	expect(catalogFilter(components, { ...filter, groups: [] })).toHaveLength(3);
	expect(catalogFilter(components, { ...filter, search: 'Inputs' }).map((row) => row.name)).toEqual(
		['SearchBox']
	);
});

test('a helper row uses its callable folder instead of its owning module category', () => {
	const grouped = categorySources(head);
	const items = explorerEntities(grouped);
	const rows = entityCatalog(items, 'functions', (id) => explorerRelations(grouped, id));
	expect(rows.find((row) => row.name === 'plural')).toHaveProperty('group', {
		id: 'strings',
		title: 'Strings'
	});
	expect(rows.find((row) => row.name === 'filterOrders')).toHaveProperty('group', {
		id: 'orders',
		title: 'Orders'
	});
});
