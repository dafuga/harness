import { test } from 'vitest';
import { explorerLegacy } from '../../src/utils/projects-sessions/console-canonical/explorerLegacy';
import type { ConsoleRoute } from '../../src/utils/projects-sessions/consoleRoute';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each earlier console route is passed to explorerLegacy as the console reads it. The explorer
 * address it gives, with the branch and commit kept, is asserted and recorded as the cases of
 * its state.
 */

const sha = '3f9a0c2d7e1b4a6f8c5d9e0b2a7f4c1d8e6b3a50';
const base = '9b1e4d7a2c6f0e8b3a5d1c9f7e2b4a6d8c0e3f15';
const at = { branch: 'feature/kept#1', commit: sha };
const scope = { branch: at.branch, commit: sha };

type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

/** Maps one route and keeps the address it gives as the case's output. */
function mapping(name: string, input: ConsoleRoute): ExampleCase {
	return { name, input, output: explorerLegacy(input) };
}

/** The shared trace identity: one symbol, the unit it belongs to, and a named state. */
function recording(state: string, file: string) {
	return {
		unitId: 'function.explorer-legacy',
		symbol: 'explorerLegacy',
		state,
		evidence: 'examples-cases',
		file
	};
}

test('every legacy view without a selected unit maps to Pages at the commit it named', () => {
	const cases = [
		mapping('map view', { ...at, view: 'map' }),
		mapping('compare view with a base', { ...at, view: 'compare', base }),
		mapping('history view with a record', { ...at, view: 'history', record: 'r1' }),
		mapping('growth view', { ...at, view: 'growth' }),
		mapping('activity view', { ...at, view: 'activity' })
	];
	for (const { output } of cases) expect(output).toEqual({ ...scope, category: 'pages' });
	recordExampleCases(recording('explorer-legacy-pages', 'explorer-legacy-pages.json'), cases);
});

test('a selected unit maps to the category its id names and keeps the full id as its entity', () => {
	const units = [
		['component id', 'reports.component.harness-harness-map', 'components'],
		['function id', 'function.slugify', 'functions'],
		['page id', 'page.titles', 'pages'],
		['config id', 'reports.config.report-vite', 'configs'],
		['service id', 'service.title', 'services'],
		['audit kind, unknown to the explorer', 'reports.audit.clean-check', 'functions'],
		['an id with no kind segment', 'something-else', 'functions']
	] as const;
	const cases = units.map(([name, unit]) => mapping(name, { ...at, view: 'map', unit }));
	units.forEach(([, entity, category], index) => {
		expect(cases[index].output).toEqual({ ...scope, category, entity });
	});
	recordExampleCases(
		recording('explorer-legacy-unit-category', 'explorer-legacy-unit-category.json'),
		cases
	);
});

test('the history and growth views of a unit open its history, and the other views open its overview', () => {
	const cases = [
		mapping('history view of a service', { ...at, view: 'history', unit: 'service.title' }),
		mapping('growth view of a function', { ...at, view: 'growth', unit: 'function.slugify' }),
		mapping('map view of a service', { ...at, view: 'map', unit: 'service.title' }),
		mapping('compare view with a base', { ...at, view: 'compare', base, unit: 'function.slugify' })
	];
	expect(cases[0].output).toEqual({
		...scope,
		category: 'services',
		entity: 'service.title',
		section: 'history'
	});
	expect(cases[1].output).toEqual({
		...scope,
		category: 'functions',
		entity: 'function.slugify',
		section: 'history'
	});
	expect(cases[2].output).toEqual({ ...scope, category: 'services', entity: 'service.title' });
	expect(cases[3].output).toEqual({ ...scope, category: 'functions', entity: 'function.slugify' });
	recordExampleCases(recording('explorer-legacy-history', 'explorer-legacy-history.json'), cases);
});

test('a commit on no branch keeps no branch, and a page without a unit still opens Pages', () => {
	const noBranch = { branch: null, commit: sha };
	const cases = [
		mapping('unit on a commit no branch reaches', {
			...noBranch,
			view: 'map',
			unit: 'function.clock'
		}),
		mapping('page on a commit no branch reaches', { ...noBranch, view: 'activity' })
	];
	expect(cases[0].output).toEqual({ ...noBranch, category: 'functions', entity: 'function.clock' });
	expect(cases[1].output).toEqual({ ...noBranch, category: 'pages' });
	recordExampleCases(
		recording('explorer-legacy-no-branch', 'explorer-legacy-no-branch.json'),
		cases
	);
});
