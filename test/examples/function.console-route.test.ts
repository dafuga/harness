import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	consoleRoute,
	consoleRoutePath,
	consoleViews
} from '../../src/utils/projects-sessions/consoleRoute';

/**
 * The legacy console paths are read and written as the console calls them: each case is a path or
 * a route as the earlier console addressed it, and what the function returned is asserted and
 * recorded as the cases of its state.
 */

const sha = 'a'.repeat(40);
const older = 'b'.repeat(40);
const state = (name: string, symbol: string) => ({
	unitId: 'function.console-route',
	symbol,
	state: `console-route-${name}`,
	evidence: 'examples-cases',
	file: `console-route-${name}.json`
});

function thrownName(run: () => unknown): string | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		return (error as Error).name;
	}
}

test('Round-trips a legacy branch and revision path', () => {
	const pages: Array<[string, Parameters<typeof consoleRoutePath>[0]]> = [
		[`/branch/main/commit/${sha}/map`, { branch: 'main', commit: sha, view: 'map' }],
		[
			`/branch/feature/kept%231/commit/${sha}/map`,
			{ branch: 'feature/kept#1', commit: sha, view: 'map' }
		],
		[`/commit/${sha}/activity`, { branch: null, commit: sha, view: 'activity' }],
		[
			`/branch/fix/commit/${older}/map/commit/${sha}/history`,
			{ branch: `fix/commit/${older}/map`, commit: sha, view: 'history' }
		],
		[
			`/branch/main/commit/${sha}/compare/${older}`,
			{ branch: 'main', commit: sha, view: 'compare', base: older }
		],
		[
			`/branch/main/commit/${sha}/history/record/r1`,
			{ branch: 'main', commit: sha, view: 'history', record: 'r1' }
		]
	];
	const cases = pages.map(([path, route]) => {
		expect(consoleRoute(path)).toEqual(route);
		return {
			name: `a legacy path of ${route.view} round-trips`,
			input: route,
			output: consoleRoutePath(route)
		};
	});
	expect(cases.map(({ output }) => output)).toEqual(pages.map(([path]) => path));
	recordExampleCases(state('round-trips-a-legacy-branch-path', 'consoleRoutePath'), cases);
});

test('Refuses to write a branch with an unpaired surrogate', () => {
	const route = { branch: '\uD800', commit: sha, view: 'map' } as const;
	const error = thrownName(() => consoleRoutePath(route));
	expect(error).toBe('URIError');
	recordExampleCases(state('refuses-an-unpaired-surrogate', 'consoleRoutePath'), [
		{
			name: 'a branch holding a lone high surrogate',
			input: { route },
			error
		}
	]);
});

test('Preserves the view and selection of a page', () => {
	const cases = [
		{
			name: 'a comparison keeps its base and selected unit',
			path: `/branch/main/commit/${sha}/compare/${older}/unit/page.titles`
		},
		{
			name: 'a history view keeps its record and selected unit',
			path: `/branch/main/commit/${sha}/history/record/r1/unit/service.title`
		},
		{
			name: 'a map drops a base and a record it does not show',
			path: `/branch/main/commit/${sha}/map/${older}/record/x`
		},
		{
			name: 'a growth view on no branch keeps its unit',
			path: `/commit/${sha}/growth/unit/function.slugify`
		},
		{
			name: 'a comparison with a non-hex base keeps no base',
			path: `/branch/main/commit/${sha}/compare/not-a-commit/`
		}
	].map(({ name, path }) => ({ name, input: { path }, output: consoleRoute(path) }));
	expect(cases.map(({ output }) => output)).toEqual([
		{ branch: 'main', commit: sha, view: 'compare', base: older, unit: 'page.titles' },
		{
			branch: 'main',
			commit: sha,
			view: 'history',
			record: 'r1',
			unit: 'service.title'
		},
		{ branch: 'main', commit: sha, view: 'map' },
		{ branch: null, commit: sha, view: 'growth', unit: 'function.slugify' },
		{ branch: 'main', commit: sha, view: 'compare' }
	]);
	expect(consoleViews).toEqual(['map', 'compare', 'history', 'growth', 'activity']);
	recordExampleCases(state('preserves-view-and-selection', 'consoleRoute'), cases);
});

test('Reads no path that names no legacy page', () => {
	const invalid = [
		{ name: 'an empty path', path: '' },
		{ name: 'a path with no view', path: `/branch/main/commit/${sha}` },
		{ name: 'an unknown view', path: `/branch/main/commit/${sha}/bogus` },
		{ name: 'a commit that is not lowercase hex', path: `/commit/${sha.toUpperCase()}/map` },
		{ name: 'an empty branch segment', path: `/branch//commit/${sha}/map` },
		{ name: 'a branch with a malformed escape', path: `/branch/%E0%A4%A/commit/${sha}/map` }
	];
	const cases = invalid.map(({ name, path }) => ({
		name,
		input: { path },
		output: consoleRoute(path)
	}));
	expect(cases.map(({ output }) => output)).toEqual(invalid.map(() => undefined));
	recordExampleCases(
		state('reads-no-unrecognized-route', 'consoleRoute'),
		cases.map(({ name, input, output }) => ({
			name,
			input,
			output: output ?? { type: 'undefined' }
		}))
	);
});
