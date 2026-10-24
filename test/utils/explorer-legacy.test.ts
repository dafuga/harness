import { expect, test } from 'vitest';
import { explorerLegacy } from '../../src/utils/console-canonical/explorerLegacy';
import {
	explorerKindCategory,
	explorerRoutePath,
	explorerRoute,
	type ExplorerLocation
} from '../../src/utils/explorerRoute';

const sha = 'a'.repeat(40);
const base = 'b'.repeat(40);
const at = { branch: 'feature/kept#1', commit: sha };
const path = (route: Parameters<typeof explorerLegacy>[0]) =>
	explorerRoutePath(explorerLegacy(route));
const scope = `/branch/feature%2Fkept%231/commit/${sha}`;

test('every earlier view without a selection opens Pages at the commit it named', () => {
	for (const view of ['map', 'compare', 'history', 'growth', 'activity'] as const) {
		expect(path({ ...at, view })).toBe(`${scope}/pages`);
	}
	expect(path({ ...at, view: 'compare', base })).toBe(`${scope}/pages`);
	expect(path({ ...at, view: 'history', record: 'r1' })).toBe(`${scope}/pages`);
});

test('a selected unit opens as the entity it is, in the category its id names', () => {
	expect(path({ ...at, view: 'map', unit: 'reports.component.harness-harness-map' })).toBe(
		`${scope}/components/reports.component.harness-harness-map`
	);
	expect(path({ ...at, view: 'compare', base, unit: 'function.slugify' })).toBe(
		`${scope}/functions/function.slugify`
	);
	expect(path({ ...at, view: 'map', unit: 'page.titles' })).toBe(`${scope}/pages/page.titles`);
	expect(path({ ...at, view: 'map', unit: 'reports.config.report-vite' })).toBe(
		`${scope}/configs/reports.config.report-vite`
	);
	expect(path({ ...at, view: 'map', unit: 'service.title' })).toBe(
		`${scope}/services/service.title`
	);
	expect(path({ ...at, view: 'map', unit: 'something-else' })).toBe(
		`${scope}/functions/something-else`
	);
});

test('the history and the growth of a unit open its history', () => {
	expect(path({ ...at, view: 'history', unit: 'service.title' })).toBe(
		`${scope}/services/service.title/history`
	);
	expect(path({ ...at, view: 'growth', unit: 'function.slugify' })).toBe(
		`${scope}/functions/function.slugify/history`
	);
});

test('a commit on no branch keeps no branch', () => {
	expect(path({ branch: null, commit: sha, view: 'map', unit: 'function.clock' })).toBe(
		`/commit/${sha}/functions/function.clock`
	);
});

test('a kind is one of the seven categories or none; nothing else becomes a function', () => {
	const expected: Record<string, string[]> = {
		pages: ['page', 'view'],
		apis: ['endpoint', 'api'],
		models: ['model'],
		components: ['component', 'partial', 'shell'],
		layouts: ['layout'],
		configs: ['config', 'initializer'],
		services: ['service', 'adapter', 'repository', 'workflow', 'command'],
		functions: ['function', 'validator', 'serializer', 'kernel']
	};
	for (const [category, kinds] of Object.entries(expected)) {
		for (const kind of kinds) expect([kind, explorerKindCategory(kind)]).toEqual([kind, category]);
	}
	for (const kind of ['audit', 'guide', 'template', 'module', 'script', 'style', 'toString']) {
		expect([kind, explorerKindCategory(kind)]).toEqual([kind, null]);
	}
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
	for (const [category, contractTab] of [
		['pages', 'models'],
		['components', 'contract'],
		['layouts', 'contract']
	] as const) {
		const path = `/branch/main/${category}/visual`;
		expect(explorerRoute(path, '?tab=states')?.tab).toBe('states');
		expect(explorerRoutePath(explorerRoute(path, '?tab=tests')!)).toBe(`${path}?tab=states`);
		expect(explorerRoute(path, '?tab=contract')).toMatchObject({ tab: contractTab });
	}
	for (const category of ['functions', 'services', 'configs', 'models']) {
		const path = `/branch/main/${category}/headless`;
		expect(explorerRoute(path, '?tab=tests')!.tab).toBe(
			category === 'functions' ? 'examples' : 'tests'
		);
		expect(explorerRoute(path, '?tab=states')!.tab).toBeUndefined();
		expect(explorerRoute(path, '?tab=contract')).toMatchObject({ tab: 'contract' });
	}
	expect(explorerRoute('/branch/main/pages', '?tab=tests')?.tab).toBeUndefined();
	expect(explorerRoute('/branch/main/pages/reports.page.titles', '?tab=contract')?.tab).toBe(
		'models'
	);
	expect(
		explorerRoutePath({
			branch: 'main',
			commit: sha,
			category: 'pages',
			entity: 'reports.page.titles',
			tab: 'contract'
		})
	).toBe(`/branch/main/commit/${sha}/pages/reports.page.titles?tab=models`);
	expectRetainedContracts();
});

/** Non-page modules retain Contract while Pages canonicalize it to Models. */
function expectRetainedContracts() {
	for (const category of ['components', 'layouts', 'functions', 'services', 'configs', 'models']) {
		const path = `/branch/main/${category}/example`;
		expect(explorerRoute(path, '?tab=contract')?.tab).toBe('contract');
		expect(explorerRoutePath(explorerRoute(path, '?tab=contract')!)).toBe(`${path}?tab=contract`);
	}
}
