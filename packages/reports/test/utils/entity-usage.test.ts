import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import type { ExplorerEntity, ExplorerRelations } from '../../src/models/Explorer.types';
import { entityUsage } from '../../src/components/explorer-ui/entity-relations/entityUsage';

const entity = (id: string, category: string) => ({ id, category }) as ExplorerEntity;
const support = (id: string) =>
	({ id, role: 'Model', name: id }) as ExplorerRelations['support'][0];
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

test('what uses an entity is one list, pages first, and nothing is in it twice', () =>
	measureWorkload('reports.function.entity-usage', 'layout-catalog-behavior', () => {
		const usage = entityUsage({
			...none,
			pages: [entity('page.a', 'pages'), entity('page.b', 'pages')],
			usedBy: [
				entity('component.c', 'components'),
				entity('page.a', 'pages'),
				entity('component.c', 'components')
			]
		});
		expect(ids(usage.usedIn)).toEqual(['page.a', 'page.b', 'component.c']);
		expect([usage.uses, usage.other, usage.count]).toEqual([[], [], 0]);
	}));

test('what an entity uses stays apart by kind, without the kinds it uses nothing of', () => {
	const usage = entityUsage({
		...none,
		functions: [entity('function.f', 'functions'), entity('function.f', 'functions')],
		services: [entity('service.s', 'services')],
		support: [support('model.m'), support('model.m')]
	});
	expect(usage.uses.map((group) => [group.title, ids(group.items)])).toEqual([
		['Functions', ['function.f']],
		['Services', ['service.s']]
	]);
	expect([ids(usage.other), usage.count, usage.usedIn]).toEqual([['model.m'], 3, []]);
});
