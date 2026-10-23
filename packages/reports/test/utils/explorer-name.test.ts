import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import { explorerAppRoute, explorerName } from '../../src/utils/explorerName';
import { unit } from '../explorerFixture';

const named = (id: string, kind: string, title: string) => explorerName(unit(id, kind, { title }));

test('code names retain their declared identifier casing', () =>
	measureWorkload('reports.function.explorer-name', 'layout-catalog-behavior', () => {
		expect(named('function.console-route', 'function', 'consoleRoute')).toBe('consoleRoute');
		expect(named('reports.component.harness-harness-console', 'component', 'HarnessConsole')).toBe(
			'HarnessConsole'
		);
		expect(named('service.title', 'service', 'TitleService')).toBe('TitleService');
		expect(named('function.slugify', 'function', 'slugify')).toBe('slugify');
	}));

test('code initialisms keep the exact source spelling', () => {
	expect(named('reports.function.report-pdf', 'function', 'reportPdf')).toBe('reportPdf');
	expect(named('reports.component.analytics-cpu', 'component', 'AnalyticsCpu')).toBe(
		'AnalyticsCpu'
	);
	expect(named('reports.function.r2-evidence-config', 'function', 'r2EvidenceConfig')).toBe(
		'r2EvidenceConfig'
	);
	expect(named('function.e2e-fixtures', 'function', 'e2eFixtures')).toBe('e2eFixtures');
});

test('a title that is an address or a file is not a name; the id gives the words', () => {
	expect(named('reports.page.harness-view', 'page', '/harness/[...view]')).toBe('Harness view');
	expect(named('page.titles', 'page', '+page')).toBe('Titles');
	expect(named('reports.page.root', 'page', '/')).toBe('Root');
	expect(named('reports.style.base-2', 'style', 'base-2.css')).toBe('Base 2');
});

test('a name never shows a path, an id or a file ending', () => {
	const names = [
		named('reports.page.harness-reports-id', 'page', '/harness/reports/[id]'),
		named('reports.script.seed-e2e', 'script', 'scripts/seed-e2e.ts'),
		named('template.audit-config', 'template', 'auditConfig'),
		named('', 'function', '')
	];
	for (const name of names) expect(name).toMatch(/^[A-Z0-9][A-Za-z0-9 ]*$/);
	expect(names[3]).toBe('Unnamed');
});

test('a page says the address the application serves it at, and nothing else has one', () => {
	const page = unit('reports.page.harness-view', 'page', { title: '/harness/[...view]' });
	expect(explorerAppRoute(page)).toBe('/harness/[...view]');
	const derived = unit('page.titles', 'page', {
		title: '+page',
		owns: {
			source: ['src/routes/titles/+page.server.ts', 'src/routes/titles/+page.svelte'],
			symbols: []
		}
	});
	expect(explorerAppRoute(derived)).toBe('/titles');
	const root = unit('page.root', 'page', {
		title: '+page',
		owns: { source: ['packages/reports/src/routes/+page.svelte'], symbols: [] }
	});
	expect(explorerAppRoute(root)).toBe('/');
	expect(
		explorerAppRoute(unit('function.slugify', 'function', { title: '/not/a/page' }))
	).toBeNull();
	expect(explorerAppRoute(unit('page.odd', 'page', { title: 'Odd' }))).toBeNull();
});

test('a title a person wrote is kept as it was written', () => {
	expect(named('page.orders', 'page', 'Order history')).toBe('Order history');
	expect(named('component.cart', 'component', '  Cart summary (mini)  ')).toBe(
		'Cart summary (mini)'
	);
	// A title that is an address, a file or a dotted id is not a name a person wrote.
	expect(named('page.orders', 'page', '/orders/[id] page')).toBe('Orders');
	expect(named('function.slugify', 'function', 'function.slugify')).toBe('Slugify');
	expect(named('script.seed', 'script', 'seed data.ts')).toBe('Seed');
});

test('a route page is named for the screen its address ends in, not for its parameters', () => {
	const route = (title: string) => named('reports.page.x', 'page', title);
	const mount = '/harness/branch/[branch]/[...at]';
	expect(route(`${mount}/functions`)).toBe('Functions');
	expect(route(`${mount}/functions/[entity]`)).toBe('Function');
	expect(route(`${mount}/functions/[entity]/details`)).toBe('Function details');
	expect(route(`${mount}/services/[entity]/history`)).toBe('Service history');
	expect(route(`${mount}/pages/[entity]`)).toBe('Page');
	// An address with no screen after its parameters keeps the words of its id.
	expect(named('reports.page.harness-view', 'page', '/harness/[...view]')).toBe('Harness view');
	expect(named('page.titles', 'page', '/titles')).toBe('Titles');
});

test('only a collection of the explorer is named in the singular before a parameter', () => {
	const nested = '/projects/[projectId]/harness/[...path]';
	expect(named('desktop.page.projects-project-id-harness-path', 'page', nested)).toBe('Harness');
	expect(named('hub.page.projects-project-id-harness-path', 'page', nested)).toBe('Harness');
	// Any other route word keeps its last letter, whatever follows it.
	const route = (title: string) => named('reports.page.x', 'page', title);
	expect(route('/teams/[team]/settings/[tab]')).toBe('Settings');
	expect(route('/teams/[team]/status/[id]/details')).toBe('Status details');
	expect(route('/teams/[team]/members/[member]')).toBe('Members');
	const mount = '/harness/branch/[branch]/[...at]';
	expect(route(`${mount}/components/[entity]/details`)).toBe('Component details');
	expect(route(`${mount}/configs/[entity]`)).toBe('Config');
});

// One standard naming matrix covers every kind of code unit, including owner-local files.
test.each([
	[
		'service',
		'CheckoutService',
		'src/lib/checkout/CheckoutService.ts',
		['CheckoutOptions', 'CheckoutService', 'CheckoutResult']
	],
	[
		'adapter',
		'AgentHttpAdapter',
		'src/adapters/agent-http/AgentHttpAdapter.ts',
		['AgentHttpOptions', 'AgentHttpAdapter']
	],
	['repository', 'OrderRepository', 'src/repositories/OrderRepository.ts', ['OrderRepository']],
	[
		'workflow',
		'recordAnalytics',
		'src/cli/program/recordAnalytics.ts',
		['AnalyticsInput', 'recordAnalytics']
	],
	['function', 'formatDuration', 'src/utils/formatDuration.ts', ['formatDuration']],
	['module', 'orderRules', 'src/lib/orders/orderRules.ts', ['validateOrder', 'sortOrders']],
	['component', 'OrderList', 'src/components/order-list/OrderList.svelte', []],
	['model', 'Order', 'src/models/Order.ts', ['OrderFields', 'Order']],
	['model', 'Order.types', 'src/models/Order.types.ts', ['OrderInput', 'OrderResult'], 'Order'],
	['config', 'orderConfig', 'src/config/orderConfig.ts', ['OrderConfig', 'orderConfig']]
])(
	'%s names use the recorded code identity %s across descriptive titles',
	(kind, name, source, symbols, expectedName = name) => {
		const record = unit(`app.${kind}.orders`, kind, {
			title: 'A descriptive title for orders',
			owns: { source: [source], symbols }
		});
		expect(explorerName(record)).toBe(expectedName);
	}
);
