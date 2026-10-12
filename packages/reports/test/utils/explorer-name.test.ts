import { expect, test } from 'vitest';
import { explorerAppRoute, explorerName } from '../../src/utils/explorerName';
import { unit } from '../explorerFixture';

const named = (id: string, kind: string, title: string) => explorerName(unit(id, kind, { title }));

test('a name is the words of the title, in sentence case', () => {
	expect(named('function.console-route', 'function', 'consoleRoute')).toBe('Console route');
	expect(named('reports.component.harness-harness-console', 'component', 'HarnessConsole')).toBe(
		'Harness console'
	);
	expect(named('service.title', 'service', 'TitleService')).toBe('Title service');
	expect(named('function.slugify', 'function', 'slugify')).toBe('Slugify');
});

test('initials a reader knows stay as they are written', () => {
	expect(named('reports.function.report-pdf', 'function', 'reportPdf')).toBe('Report PDF');
	expect(named('reports.component.analytics-cpu', 'component', 'AnalyticsCpu')).toBe(
		'Analytics CPU'
	);
	expect(named('reports.function.r2-evidence-config', 'function', 'r2EvidenceConfig')).toBe(
		'R2 evidence config'
	);
	expect(named('function.e2e-fixtures', 'function', 'e2eFixtures')).toBe('E2E fixtures');
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
