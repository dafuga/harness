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

/** The nineteen designed shapes of one scope: five indexes, five overviews, five details, four histories. */
const shapes: Array<[string, Partial<ExplorerLocation>]> = [
	['/pages', { category: 'pages' }],
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

test('has exactly seven categories, pages then shells first', () => {
	expect(explorerCategories).toEqual([
		'pages',
		'shells',
		'components',
		'functions',
		'configs',
		'services',
		'models'
	]);
});

test.each(shapes)('current branch %s', (tail, selected) => {
	const location = { branch, commit: null, ...selected } as ExplorerLocation;
	const path = `/branch/${encoded}${tail}`;
	expect(explorerRoute(path)).toEqual(location);
	expect(explorerRoutePath(location)).toBe(path.replace(/\/details$/, '?tab=contract'));
});

test.each(shapes)('selected commit %s', (tail, selected) => {
	const location = { branch, commit: sha, ...selected } as ExplorerLocation;
	const path = `/branch/${encoded}/commit/${sha}${tail}`;
	expect(explorerRoute(path)).toEqual(location);
	expect(explorerRoutePath(location)).toBe(path.replace(/\/details$/, '?tab=contract'));
});

test('there are nineteen designed shapes in each scope, and a Page has a history too', () => {
	expect(shapes).toHaveLength(19);
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

test('the tab of a section is kept in the query and only where it exists', () => {
	const source: ExplorerLocation = {
		branch: 'main',
		commit: null,
		category: 'pages',
		entity: 'reports.page.titles',
		section: 'details',
		tab: 'source'
	};
	expect(explorerRoutePath(source)).toBe('/branch/main/pages/reports.page.titles?tab=source');
	expect(explorerRoute('/branch/main/pages/reports.page.titles/details', '?tab=source')).toEqual(
		source
	);
	expect(explorerRoute('/branch/main/pages/reports.page.titles', '?tab=source')?.tab).toBe(
		'source'
	);
	expect(explorerRoutePath({ ...source, tab: 'measurements' })).toBe(
		'/branch/main/pages/reports.page.titles'
	);
	const plain = explorerRoute('/branch/main/pages/reports.page.titles/details', '?tab=tests');
	expect(plain?.tab).toBeUndefined();
	expect(explorerRoute('/branch/main/pages/reports.page.titles', '?tab=tests')?.tab).toBe('states');
	for (const category of ['pages', 'components', 'shells']) {
		const path = `/branch/main/${category}/visual`;
		expect(explorerRoute(path, '?tab=states')?.tab).toBe('states');
		expect(explorerRoutePath(explorerRoute(path, '?tab=tests')!)).toBe(`${path}?tab=states`);
	}
	for (const category of ['functions', 'services', 'configs']) {
		const path = `/branch/main/${category}/headless`;
		expect(explorerRoute(path, '?tab=tests')!.tab).toBe(
			category === 'functions' ? 'examples' : 'tests'
		);
		expect(explorerRoute(path, '?tab=states')!.tab).toBeUndefined();
	}
	expect(explorerRoute('/branch/main/pages', '?tab=tests')?.tab).toBeUndefined();
	expect(explorerRoute('/branch/main/pages/reports.page.titles', '?tab=contract')?.tab).toBe(
		'contract'
	);
	expect(
		explorerRoutePath({
			branch: 'main',
			commit: sha,
			category: 'pages',
			entity: 'reports.page.titles',
			tab: 'contract'
		})
	).toBe(`/branch/main/commit/${sha}/pages/reports.page.titles?tab=contract`);
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
	'/branch/main/pages/x/details/extra',
	'/branch/feature/kept/pages',
	'/branch/%E0%A4%A/pages',
	`/branch/main/commit/${sha}/map`
])('names no explorer address: %s', (path) => {
	expect(explorerRoute(path)).toBeUndefined();
});

test('a trailing slash names the same address', () => {
	expect(explorerRoute('/branch/main/pages/')).toEqual({
		branch: 'main',
		commit: null,
		category: 'pages'
	});
});
