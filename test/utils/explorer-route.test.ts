import { assertApiRoutes } from './explorer-route/apis';
import { measureWorkload } from '../support/measureWorkload';
import { expect, test } from 'vitest';
import {
	explorerCategories,
	explorerRoute,
	explorerRoutePath,
	type ExplorerLocation
} from '../../src/utils/explorerRoute';
const sha = 'a'.repeat(40);
const branch = 'feature/kept#1';
const encoded = 'feature%2Fkept%231';
const entity = 'reports.component.harness-harness-console';
const shapes: Array<[string, Partial<ExplorerLocation>]> = [
	['/modules', { category: 'pages', screen: 'modules' }],
	['/modules/email', { category: 'pages', screen: 'modules', entity: 'email' }],
	[
		'/module-resources/email.email',
		{ category: 'pages', screen: 'module-resources', entity: 'email.email' }
	],
	['/pages', { category: 'pages' }],
	['/dependencies', { category: 'pages', screen: 'dependencies' }],
	['/styles', { category: 'pages', screen: 'styles' }],
	['/pages/reports.page.titles', { category: 'pages', entity: 'reports.page.titles' }],
	[
		'/pages/reports.page.titles/details',
		{ category: 'pages', entity: 'reports.page.titles', section: 'details' }
	],
	['/components', { category: 'components' }],
	[`/components/${entity}`, { category: 'components', entity }],
	[`/components/${entity}/details`, { category: 'components', entity, section: 'details' }],
	[`/components/${entity}/history`, { category: 'components', entity, section: 'history' }],
	['/functions', { category: 'functions' }],
	['/functions/function.slugify', { category: 'functions', entity: 'function.slugify' }],
	[
		'/functions/function.slugify/details',
		{ category: 'functions', entity: 'function.slugify', section: 'details' }
	],
	[
		'/functions/function.slugify/history',
		{ category: 'functions', entity: 'function.slugify', section: 'history' }
	],
	['/configs', { category: 'configs' }],
	['/configs/config.site', { category: 'configs', entity: 'config.site' }],
	[
		'/configs/config.site/details',
		{ category: 'configs', entity: 'config.site', section: 'details' }
	],
	[
		'/configs/config.site/history',
		{ category: 'configs', entity: 'config.site', section: 'history' }
	],
	['/types', { category: 'types' }],
	['/types/model.input', { category: 'types', entity: 'model.input' }],
	['/types/model.input/details', { category: 'types', entity: 'model.input', section: 'details' }],
	['/types/model.input/history', { category: 'types', entity: 'model.input', section: 'history' }],
	['/services', { category: 'services' }],
	['/services/service.clock', { category: 'services', entity: 'service.clock' }],
	[
		'/services/service.clock/details',
		{ category: 'services', entity: 'service.clock', section: 'details' }
	],
	[
		'/services/service.clock/history',
		{ category: 'services', entity: 'service.clock', section: 'history' }
	]
];
test('keeps page and module entity categories separate from primary navigation', () =>
	measureWorkload('function.explorer-route', 'layout-catalog-behavior', () => {
		expect(explorerCategories).toEqual([
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
	}));
test.each(shapes)('current branch %s', (tail, selected) => {
	const location = { branch, commit: null, ...selected } as ExplorerLocation;
	const path = `/branch/${encoded}${tail}`;
	expect(explorerRoute(path)).toEqual(location);
	expect(explorerRoutePath(location)).toBe(
		path.replace(/\/details$/, location.category === 'pages' ? '?tab=models' : '?tab=contract')
	);
});
test.each(shapes)('selected commit %s', (tail, selected) => {
	const location = { branch, commit: sha, ...selected } as ExplorerLocation;
	const path = `/branch/${encoded}/commit/${sha}${tail}`;
	expect(explorerRoute(path)).toEqual(location);
	expect(explorerRoutePath(location)).toBe(
		path.replace(/\/details$/, location.category === 'pages' ? '?tab=models' : '?tab=contract')
	);
});
test('there are twenty-three designed shapes in each scope, and a Page has a history too', () => {
	expect(shapes).toHaveLength(25);
	const history: ExplorerLocation = {
		branch: 'main',
		commit: null,
		category: 'pages',
		entity: 'reports.page.titles',
		section: 'history'
	};
	expect(explorerRoute('/branch/main/pages/reports.page.titles/history')).toEqual(history);
	expect(explorerRoute(`/branch/main/commit/${sha}/pages/reports.page.titles/history`)).toEqual({
		...history,
		commit: sha
	});
});
test('a branch is one path segment, whatever it contains', () => {
	const path = explorerRoutePath({ branch: 'a/b c%d?e', commit: null, category: 'pages' });
	expect(path).toBe('/branch/a%2Fb%20c%25d%3Fe/pages');
	expect(path.split('/')).toHaveLength(4);
	expect(explorerRoute(path)?.branch).toBe('a/b c%d?e');
});
test('a branch or a commit alone opens Pages in the same scope', () => {
	expect(explorerRoute(`/branch/${encoded}`)).toEqual({
		branch,
		commit: null,
		category: 'pages'
	});
	expect(explorerRoute(`/branch/${encoded}/commit/${sha}`)).toEqual({
		branch,
		commit: sha,
		category: 'pages'
	});
});
test('a commit that no branch reaches has no branch invented for it', () => {
	const location: ExplorerLocation = { branch: null, commit: sha, category: 'functions' };
	expect(explorerRoutePath(location)).toBe(`/commit/${sha}/functions`);
	expect(explorerRoute(`/commit/${sha}/functions`)).toEqual(location);
});
test('a callable has a distinct revision-bound address across tabs and history', () => {
	for (const commit of [null, sha]) {
		const location = {
			branch,
			commit,
			category: 'functions' as const,
			entity: 'function.case',
			helper: 'toKebabCase',
			tab: 'contract' as const
		};
		const path = explorerRoutePath(location);
		const url = new URL(path, 'http://localhost');
		const prefix = `/branch/${encoded}${commit ? `/commit/${commit}` : ''}`;
		expect(url.pathname, 'Readable helper paths').toBe(
			`${prefix}/helpers/toKebabCase/in/function.case/contract`
		);
		expect(url.search).toBe('');
		const short = { ...location, entity: undefined };
		const simple = `${prefix}/helpers/toKebabCase/contract`;
		expect(explorerRoute(simple)).toEqual(short);
		expect(explorerRoutePath(short)).toBe(simple);
		expect(explorerRoute(url.pathname, url.search)).toEqual(location);
		const history = { ...location, section: 'history' as const, tab: undefined };
		const at = new URL(explorerRoutePath(history), 'http://localhost');
		expect(explorerRoute(at.pathname, at.search)).toEqual(history);
	}
	const component = explorerRoute('/branch/main/components/card', '?helper=wrong');
	expect(component).not.toHaveProperty('helper');
	expect(explorerRoute('/branch/main/functions', '?helper=wrong')).not.toHaveProperty('helper');
});
test('an entity id is one encoded segment', () => {
	const location: ExplorerLocation = {
		branch: 'main',
		commit: null,
		category: 'pages',
		entity: 'page./harness/[...view]'
	};
	const path = explorerRoutePath(location);
	expect(path).toBe('/branch/main/pages/page.%2Fharness%2F%5B...view%5D');
	expect(explorerRoute(path)).toEqual(location);
});
test.each([
	'',
	'/',
	'/pages',
	'/branch',
	'/branch/main/reports',
	'/branch/main/analytics',
	'/branch/main/activity',
	'/branch/main/commit/abc/pages',
	`/branch/main/commit/${sha.toUpperCase()}/pages`,
	'/branch/main/pages/x/source',
	'/branch/main/dependencies/x',
	'/branch/main/dependencies/history',
	'/branch/main/pages/x/details/extra',
	'/branch/feature/kept/pages',
	'/branch/%E0%A4%A/pages',
	`/branch/main/commit/${sha}/map`
])('names no explorer address: %s', (path) => {
	expect(explorerRoute(path)).toBeUndefined();
});
test('a trailing slash names the same address', () => {
	const expected = { branch: 'main', commit: null, category: 'pages' };
	expect(explorerRoute('/branch/main/pages/')).toEqual(expected);
});

test('Models is a page tab and legacy page Contract links open Models in the same scope', () => {
	const path = `/branch/main/commit/${sha}/pages/page.orders`;
	for (const tab of ['models', 'contract']) {
		const route = explorerRoute(path, `?tab=${tab}`)!;
		expect(route.tab).toBe('models');
		expect(explorerRoutePath(route)).toBe(`${path}?tab=models`);
	}
	expect(explorerRoute('/branch/main/components/card', '?tab=models')?.tab).toBeUndefined();
	expect(explorerRoute('/branch/main/components/card', '?tab=contract')?.tab).toBe('contract');
});

test('APIs are scoped catalog addresses and a page keeps its APIs tab', assertApiRoutes);
