import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { HarnessScenario, HarnessUnit } from '../../src/models/Harness.types';
import { explorerRelations } from '../../src/utils/explorerRelations';
import { scenarioFor } from '../../src/utils/explorerState';
import { revision } from '../explorerFixture';

// The registry and the scenario of this repository as they are stored: what `harness units
// index` derived from the source, and the contract the console's own browser checks record.
const specification = join(import.meta.dirname, '../../../../specification');
const stored = <T>(path: string) =>
	JSON.parse(readFileSync(join(specification, path), 'utf8')) as T;
const units = readdirSync(join(specification, 'units')).map((file) =>
	stored<HarnessUnit>(`units/${file}`)
);
const scenario = stored<HarnessScenario>('scenarios/harness-console.json');
const head = revision(units, [scenario], []);
const at = 'reports.page.harness-branch-branch-at-';
const part = 'reports.component.harness-';
const categories = ['pages', 'shells', 'components', 'functions', 'configs', 'services'];
// What a unit is made of: the shells it mounts and the components it holds.
const drawn = (id: string) => {
	const { shells, components } = explorerRelations(head, id);
	return [...shells, ...components].map((item) => item.id.replace(part, '')).sort();
};
const statesOf = (id: string) => scenarioFor(scenario, id, units).states.map((state) => state.id);
const pagesOf = (id: string) =>
	explorerRelations(head, id)
		.pages.map((item) => item.id.replace(at, ''))
		.sort();

test('the registry records each page as made of the host and the one screen it mounts', () => {
	const overview: Record<string, string> = {
		pages: 'entity-visual-screen',
		shells: 'entity-visual-screen',
		components: 'entity-visual-screen',
		functions: 'entity-behavior-screen',
		configs: 'entity-config-screen',
		services: 'entity-behavior-screen'
	};
	for (const category of categories) {
		const catalog = category === 'pages' ? 'explorer-pages-screen' : 'explorer-catalog-screen';
		expect([category, drawn(at + category)]).toEqual([category, [catalog, 'screen']]);
		expect([category, drawn(`${at}${category}-entity`)]).toEqual([
			category,
			[overview[category], 'screen']
		]);
		expect([category, drawn(`${at}${category}-entity-details`)]).toEqual([
			category,
			['entity-details-screen', 'screen']
		]);
		expect([category, drawn(`${at}${category}-entity-history`)]).toEqual([
			category,
			['entity-history-screen', 'screen']
		]);
	}
});

test('the host is made of the bar alone, and only the page of no screen names every screen', () => {
	expect(drawn(`${part}screen`)).toEqual(['harness-console']);
	expect(drawn(`${part}harness-console`)).toEqual(['harness-header']);
	expect(drawn('reports.page.harness-view')).toEqual(['explorer-content', 'screen']);
	const users = units.filter((unit) =>
		unit.dependencies.some((used) => used.unit === `${part}explorer-content`)
	);
	expect(users.map((unit) => unit.id).sort()).toEqual([
		`${part}harness-shell`,
		'reports.page.harness-view'
	]);
});

test('a screen is recorded on the pages that mount it and on no other route page', () => {
	const entity = categories.map((category) => `${category}-entity`);
	const routed = (id: string) => pagesOf(id).filter((page) => !page.startsWith('reports.'));
	expect(routed(`${part}explorer-pages-screen`)).toEqual(['pages']);
	expect(routed(`${part}explorer-catalog-screen`)).toEqual(
		categories.filter((category) => category !== 'pages').sort()
	);
	expect(routed(`${part}entity-config-screen`)).toEqual(['configs-entity']);
	expect(routed(`${part}entity-visual-screen`)).toEqual([
		'components-entity',
		'pages-entity',
		'shells-entity'
	]);
	expect(routed(`${part}entity-behavior-screen`)).toEqual(['functions-entity', 'services-entity']);
	expect(routed(`${part}entity-history-screen`)).toEqual(
		entity.map((page) => `${page}-history`).sort()
	);
	expect(routed(`${part}entity-details-screen`)).toEqual(
		entity.map((page) => `${page}-details`).sort()
	);
});

test('a page is under its own states, and a screen under the states of the pages that mount it', () => {
	expect(statesOf(`${at}pages`)).toEqual(['pages', 'catalog-filters']);
	expect(statesOf(`${at}configs-entity`)).toEqual(['config']);
	expect(statesOf(`${at}functions-entity-history`)).toEqual(['history']);
	// The page of no screen can draw any of them, so its one state shows every screen too.
	expect(statesOf(`${part}explorer-pages-screen`)).toEqual([
		'pages',
		'retained',
		'shell-retained',
		'catalog-filters'
	]);
	expect(statesOf(`${part}entity-config-screen`)).toEqual(['config', 'retained', 'shell-retained']);
	expect(statesOf(`${part}entity-history-screen`)).toEqual([
		'history',
		'page-history',
		'component-history',
		'config-history',
		'service-history',
		'retained',
		'shell-history',
		'shell-retained'
	]);
	expect(statesOf(`${part}entity-history`)).toEqual(statesOf(`${part}entity-history-screen`));
});

// What each Shells state shows, written out here rather than read from the scenario: the page it
// is reached on and, where an old Components address is corrected, the correction too.
const corrected = 'reports.function.corrected-location';
const shellStates: Array<[string, string[]]> = [
	['shells', [`${at}shells`]],
	['shells-tip', [`${at}shells`]],
	['shell', [`${at}shells-entity`]],
	['shell-details', [`${at}shells-entity-details`]],
	['shell-history', [`${at}shells-entity-history`]],
	['shell-redirect', [`${at}shells-entity-details`, corrected]],
	['shell-earlier', [`${at}components-entity`, corrected]],
	['shell-retained', ['reports.page.harness-view']]
];
// What each search state shows, written out here: the catalog it is typed on, the adapter of the
// console, the search of the bar and the shared field with its results.
const searching = [
	'reports.function.explorer-search-entries',
	'reports.function.navbar-search',
	'reports.function.entity-search',
	'reports.component.entity-search',
	'reports.component.entity-search-results'
];
const searchStates: Array<[string, string[]]> = [
	['search', [`${at}shells`, ...searching]],
	['search-pinned', [`${at}functions`, ...searching]]
];
const contracts = [
	'reports.component.entity-contract',
	'reports.function.contract-fields',
	`${at}functions-entity`
];
const contractStates: Array<[string, string[]]> = [
	['contract', contracts],
	['contract-commit', contracts],
	[
		'contract-example',
		[...contracts, 'reports.component.contract-example', 'reports.component.modal']
	],
	[
		'contract-example-commit',
		[...contracts, 'reports.component.contract-example', 'reports.component.modal']
	]
];
const written = [
	...shellStates,
	...searchStates,
	...contractStates,
	['catalog-filters', ['reports.component.filter-dialog', `${part}explorer-controls`, `${at}pages`]]
];

test('what every page is made of is under every state, and each state names a page there is', () => {
	const every = scenario.states.map((state) => state.id);
	expect(every).toHaveLength(49);
	expect(statesOf(`${part}harness-header`)).toEqual(every);
	expect(statesOf(`${part}harness-console`)).toEqual(every);
	const pages = new Set(units.filter((unit) => unit.kind === 'page').map((unit) => unit.id));
	const named = new Set(written.map(([id]) => id));
	// Earlier states name exactly one page; later states also name the shared pieces they show.
	const earlier = scenario.states.filter((state) => !named.has(state.id));
	expect(earlier).toHaveLength(34);
	for (const state of earlier) {
		expect([state.id, state.units?.length, state.units?.every((id) => pages.has(id))]).toEqual([
			state.id,
			1,
			true
		]);
	}
	// The later states are exactly these, in this order, each naming what it shows.
	const later = scenario.states.filter((state) => named.has(state.id));
	expect(later.map((state) => [state.id, state.units])).toEqual(written);
	const registered = new Set(units.map((unit) => unit.id));
	expect(written.flatMap(([, ids]) => ids).filter((id) => !registered.has(id))).toEqual([]);
});
