import { expect, test } from 'vitest';
import { consoleRoute, consoleRoutePath, type ConsoleRoute } from '../../src/utils/consoleRoute';

const commit = 'a'.repeat(40);
const older = 'b'.repeat(40);
const pages: Array<[string, ConsoleRoute]> = [
	[`/branch/main/commit/${commit}/map`, { branch: 'main', commit, view: 'map' }],
	[
		`/branch/feat/agentic-self-hosting/commit/${commit}/history`,
		{ branch: 'feat/agentic-self-hosting', commit, view: 'history' }
	],
	[
		`/branch/feature/kept%231/commit/${commit}/map/unit/service.title`,
		{ branch: 'feature/kept#1', commit, view: 'map', unit: 'service.title' }
	],
	[
		`/commit/${commit}/growth/unit/function.slugify`,
		{ branch: null, commit, view: 'growth', unit: 'function.slugify' }
	],
	[
		`/branch/main/commit/${commit}/compare/${older}/unit/page.titles`,
		{ branch: 'main', commit, view: 'compare', base: older, unit: 'page.titles' }
	],
	[
		`/branch/main/commit/${commit}/history/record/${'c'.repeat(64)}`,
		{ branch: 'main', commit, view: 'history', record: 'c'.repeat(64) }
	]
];

test.each(pages)('%s is one page, and formats back to the same path', (path, route) => {
	expect(consoleRoute(path)).toEqual(route);
	expect(consoleRoutePath(route)).toBe(path);
	expect(consoleRoute(`${path}/`)).toEqual(route);
});

test('a branch whose name looks like part of a path is still read whole', () => {
	const branch = `fix/commit/${older}/map`;
	const path = consoleRoutePath({ branch, commit, view: 'history' });
	expect(consoleRoute(path)).toEqual({ branch, commit, view: 'history' });
	expect(consoleRoutePath({ branch: 'a b/ü', commit, view: 'map' })).toBe(
		`/branch/a%20b/%C3%BC/commit/${commit}/map`
	);
});

test('what names no page is not read as one', () => {
	const invalid = [
		'',
		'/',
		`/branch/main/commit/${commit}`,
		`/branch/main/commit/${commit}/bogus`,
		`/branch/main/commit/${commit.slice(1)}/map`,
		`/branch//commit/${commit}/map`,
		`/branch/%E0%A4%A/commit/${commit}/map`,
		`/reports`,
		`/commit/${commit.toUpperCase()}/map`
	];
	for (const path of invalid) expect([path, consoleRoute(path)]).toEqual([path, undefined]);
	// Parts that do not belong to a view are ignored rather than carried along.
	expect(consoleRoute(`/commit/${commit}/map/${older}/record/x`)).toEqual({
		branch: null,
		commit,
		view: 'map'
	});
});
