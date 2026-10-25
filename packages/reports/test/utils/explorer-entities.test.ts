import { expect, test } from 'vitest';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { explorerRelations } from '../../src/utils/explorerRelations';
import { complete, declared, record, result, revision, unit } from '../explorerFixture';

const uses = (...ids: string[]) => ({
	dependencies: ids.map((id) => ({ unit: id, via: 'import' }))
});
const owns = (path: string) => ({ owns: { source: [path], symbols: [] } });
const units = [
	unit('page.orders', 'page', {
		...owns('src/routes/orders/+page.svelte'),
		...uses('component.list', 'config.site', 'module.barrel')
	}),
	unit('page.loader', 'page', owns('src/routes/+page.server.ts')),
	unit('component.list', 'component', {
		title: 'OrderList',
		...uses('component.row', 'service.orders')
	}),
	unit('component.row', 'component', { title: 'OrderRow', ...uses('function.money', 'style.row') }),
	unit('function.money', 'function', { title: 'formatMoney' }),
	unit('function.total', 'function', { title: 'orderTotal', ...uses('function.money') }),
	unit('module.barrel', 'module', uses('function.total')),
	unit('config.site', 'config', { title: 'siteConfig' }),
	unit('service.orders', 'service', {
		title: 'OrderService',
		...uses('function.total', 'config.site')
	}),
	unit('style.row', 'style'),
	unit('function.gone', 'function', { status: 'retired' })
];
const impact = {
	base: null,
	expanded: false,
	units: {
		direct: ['function.money'],
		indirect: ['component.row'],
		added: ['config.site'],
		removed: []
	},
	scenarios: [],
	uncertain: [],
	changed: []
};
const scenario = declared({ units: ['page.orders', 'component.list'] });
const head = revision(units, [scenario], [record([result(complete())])], { sourceImpact: impact });
const entities = explorerEntities(head);
const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);
const related = (id: string) => explorerRelations(head, id);

test('the active units of the five kinds are listed, each once, pages first', () => {
	expect(ids(entities)).toEqual([
		'page.orders',
		'component.list',
		'component.row',
		'function.money',
		'function.total',
		'config.site',
		'page.loader',
		'service.orders'
	]);
	expect(
		entities.map((item) => item.category).filter((item, at, all) => all.indexOf(item) === at)
	).toEqual(['pages', 'components', 'functions', 'configs', 'services']);
});

test('an entity has a name, a role, a purpose, a verdict and how the commit changed it', () => {
	const page = entities[0];
	expect(page).toMatchObject({
		name: 'Orders',
		role: 'Page',
		purpose: 'What page.orders is for.',
		appRoute: '/orders',
		change: null,
		verdict: { passed: true, label: 'Full coverage passed' }
	});
	const byId = new Map(entities.map((item) => [item.id, item]));
	expect(byId.get('function.money')).toMatchObject({ name: 'formatMoney', change: 'direct' });
	expect(byId.get('component.row')).toMatchObject({ change: 'indirect', appRoute: null });
	expect(byId.get('config.site')?.change).toBe('added');
	expect(byId.get('page.loader')).toMatchObject({ category: 'services', role: 'Route loader' });
	expect(byId.get('component.row')?.verdict.passed).toBe(false);
});

test('a page contains components, and components contain components and then functions', () => {
	expect(ids(related('page.orders').components)).toEqual(['component.list']);
	expect(ids(related('component.list').components)).toEqual(['component.row']);
	expect(ids(related('component.row').components)).toEqual([]);
	expect(ids(related('component.row').functions)).toEqual(['function.money']);
});

test('configs and services are sections of their own', () => {
	expect(ids(related('page.orders').configs)).toEqual(['config.site']);
	expect(ids(related('component.list').services)).toEqual(['service.orders']);
	expect(ids(related('service.orders').configs)).toEqual(['config.site']);
	expect(ids(related('service.orders').functions)).toEqual(['function.total']);
});

test('what is none of the five kinds is named with its role, and what is behind it stays reachable', () => {
	const page = related('page.orders');
	expect(page.support).toEqual([expect.objectContaining({ id: 'module.barrel', role: 'Module' })]);
	expect(ids(page.functions)).toEqual(['function.total']);
	expect(related('component.row').support).toEqual([
		expect.objectContaining({ id: 'style.row', role: 'Style sheet' })
	]);
});

test('an entity names the pages that show it at any depth, and what else uses it', () => {
	expect(ids(related('function.money').pages)).toEqual(['page.orders']);
	expect(ids(related('component.row').pages)).toEqual(['page.orders']);
	expect(ids(related('page.orders').pages)).toEqual([]);
	expect(ids(related('function.money').usedBy)).toEqual(['component.row', 'function.total']);
	expect(ids(related('config.site').usedBy)).toEqual(['service.orders']);
	expect(ids(related('function.total').usedBy)).toEqual(['service.orders']);
});

test('an entity that is not at the revision has no relations, and a cycle ends', () => {
	expect(related('function.nowhere')).toEqual({
		pages: [],
		apis: [],
		layouts: [],
		components: [],
		functions: [],
		configs: [],
		models: [],
		types: [],
		services: [],
		usedBy: [],
		support: []
	});
	const loop = revision(
		[
			unit('module.a', 'module', uses('module.b')),
			unit('module.b', 'module', uses('module.a', 'function.x')),
			unit('function.x', 'function', uses('module.a'))
		],
		[],
		[]
	);
	expect(ids(explorerRelations(loop, 'function.x').support).sort()).toEqual([
		'module.a',
		'module.b'
	]);
	expect(ids(explorerRelations(loop, 'function.x').functions)).toEqual([]);
});

test('a unit the shown commit removed is listed from its parent, with its last contract', () => {
	const before = revision(
		[...units, unit('function.old', 'function', { title: 'oldHelper' })],
		[],
		[],
		{
			commit: 'b'.repeat(40)
		}
	);
	const removal = {
		...impact,
		units: { ...impact.units, removed: ['function.old', 'function.unknown'] }
	};
	// A retired unit stays in the registry as a tombstone; it is still gone from this commit.
	const tombstone = unit('function.old', 'function', { status: 'retired' });
	const after = revision([...units, tombstone], [scenario], [record([result(complete())])], {
		sourceImpact: removal
	});
	const listed = explorerEntities(after, before);
	const old = listed.find((item) => item.id === 'function.old');
	expect(old).toMatchObject({
		name: 'oldHelper',
		category: 'functions',
		change: 'removed',
		lastAt: 'b'.repeat(40),
		verdict: { passed: false, label: 'Removed at this commit' }
	});
	expect(old?.unit.title).toBe('oldHelper');
	// It is listed once, after what the commit still holds, and only what the parent held is.
	expect(ids(listed).filter((id) => id === 'function.old')).toHaveLength(1);
	expect(ids(listed)).not.toContain('function.unknown');
	expect(listed.filter((item) => item.lastAt).map((item) => item.id)).toEqual(['function.old']);
	// Without the parent revision nothing is made up for it, and a tip lists what it holds.
	expect(ids(explorerEntities(after))).not.toContain('function.old');
	expect(ids(explorerEntities(after, null))).not.toContain('function.old');
	expect(ids(explorerRelations(before, 'function.old').usedBy)).toEqual([]);
});

test('private functions are absent from collections and stay with their owner as support', () => {
	const privateFunction = unit('function.private', 'function', {
		helpers: [
			{
				name: 'private',
				source: 'src/components/one/private.ts',
				inputs: [],
				pure: true,
				consumers: [{ unit: 'component.one' }]
			}
		]
	});
	const owner = unit('component.one', 'component', uses(privateFunction.id));
	const detail = revision([owner, privateFunction], [], []);
	expect(ids(explorerEntities(detail))).toEqual([owner.id]);
	expect(explorerRelations(detail, owner.id).functions).toEqual([]);
	expect(explorerRelations(detail, owner.id).support.map((item) => item.id)).toEqual([
		privateFunction.id
	]);
});
