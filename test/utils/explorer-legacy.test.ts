import { expect, test } from 'vitest';
import { explorerLegacy } from '../../src/utils/explorerLegacy';
import { explorerKindCategory, explorerRoutePath } from '../../src/utils/explorerRoute';

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

test('a kind is one of the five categories or none; nothing else becomes a function', () => {
	const expected: Record<string, string[]> = {
		pages: ['page', 'view'],
		components: ['component', 'partial', 'layout'],
		configs: ['config', 'initializer'],
		services: ['service', 'endpoint', 'api', 'adapter', 'repository', 'workflow', 'command'],
		functions: ['function', 'validator', 'serializer', 'kernel']
	};
	for (const [category, kinds] of Object.entries(expected)) {
		for (const kind of kinds) expect([kind, explorerKindCategory(kind)]).toEqual([kind, category]);
	}
	for (const kind of [
		'audit',
		'guide',
		'template',
		'model',
		'module',
		'script',
		'style',
		'toString'
	]) {
		expect([kind, explorerKindCategory(kind)]).toEqual([kind, null]);
	}
});
