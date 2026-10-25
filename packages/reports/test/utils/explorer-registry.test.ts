import { written } from '../explorerRegistryStates';
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
const categories = [
	'pages',
	'apis',
	'layouts',
	'components',
	'functions',
	'configs',
	'services',
	'models',
	'types'
];
// Direct registered composition, before catalog folding or transitive relationship projection.
const drawn = (id: string) => {
	const source = units.find((unit) => unit.id === id)!;
	return source.dependencies
		.flatMap(({ unit: dependency }) => {
			const target = units.find((unit) => unit.id === dependency);
			return target &&
				['component', 'layout', 'shell', 'partial'].includes(target.kind) &&
				target.composition?.level !== 'atom'
				? [dependency.replace(part, '')]
				: [];
		})
		.sort();
};
const statesOf = (id: string) => scenarioFor(scenario, id, units).states.map((state) => state.id);
const pagesOf = (id: string) =>
	explorerRelations(head, id)
		.pages.map((item) => item.id.replace(at, ''))
		.sort();

test('the registry records each page as made of the host and the one screen it mounts', () => {
	const overview: Record<string, string> = {
		pages: 'entity-visual-screen',
		apis: 'entity-behavior-screen',
		layouts: 'entity-visual-screen',
		components: 'entity-visual-screen',
		functions: 'entity-behavior-screen',
		configs: 'entity-config-screen',
		models: 'entity-config-screen',
		types: 'entity-config-screen',
		services: 'entity-behavior-screen'
	};
	for (const category of categories) {
		const catalog = category === 'pages' ? 'explorer-pages-screen' : 'explorer-catalog-screen';
		expect([category, drawn(at + category)]).toEqual([category, [catalog, 'screen']]);
		expect([category, drawn(`${at}${category}-entity`)]).toEqual([
			category,
			[overview[category], 'screen'].sort()
		]);
		if (category !== 'apis')
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

test('the host uses shared frame pieces, and only the page of no screen names every screen', () => {
	expect(drawn('reports.layout.root')).toEqual(['reports.component.console-chat']);
	expect(drawn(`${part}screen`)).toEqual(['harness-console']);
	expect(drawn(`${part}harness-console`)).toEqual([
		'reports.component.shared-primitives-loading-state',
		'reports.layout.explorer-layout'
	]);
	expect(drawn('reports.layout.explorer-layout')).toEqual(['harness-header']);
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
	expect(routed(`${part}entity-config-screen`)).toEqual([
		'configs-entity',
		'models-entity',
		'types-entity'
	]);
	expect(routed(`${part}entity-visual-screen`)).toEqual([
		'components-entity',
		'layouts-entity',
		'pages-entity'
	]);
	expect(routed(`${part}entity-behavior-screen`)).toEqual([
		'apis-entity',
		'functions-entity',
		'services-entity'
	]);
	expect(routed(`${part}entity-history-screen`)).toEqual(
		entity.map((page) => `${page}-history`).sort()
	);
	expect(routed(`${part}entity-details-screen`)).toEqual([]);
	const aliases = explorerRelations(head, `${part}entity-details-screen`)
		.usedBy.filter((item) => item.role === 'Route alias')
		.map((item) => item.id.replace(at, ''))
		.sort();
	expect(aliases).toEqual(
		[
			...entity.filter((page) => page !== 'apis-entity').map((page) => `${page}-details`),
			'shells-entity-details'
		].sort()
	);
});

const visual = (id: string) =>
	['page', 'shell', 'component', 'layout', 'partial'].includes(
		units.find((unit) => unit.id === id)?.kind ?? ''
	);
const naming = (id: string) =>
	scenario.states.filter((state) => state.units?.includes(id)).map((state) => state.id);

test('a visual unit is under exactly the states that name it, and never under another screen', () => {
	expect(statesOf(`${at}pages`)).toEqual(['pages']);
	expect(statesOf(`${at}configs-entity`)).toEqual(['config', 'config-details']);
	expect(statesOf(`${at}functions-entity-history`)).toEqual(['history']);
	// Each page, shell and component the scenario covers is named by a state whose capture shows it.
	const covered = scenario.units.filter(visual);
	expect(covered.filter((id) => naming(id).length === 0)).toEqual([]);
	expect(covered.map((id) => [id, statesOf(id)])).toEqual(covered.map((id) => [id, naming(id)]));
	// Named by no state, a screen is under none: what imports it does not lend it its captures.
	for (const id of [`${part}entity-history-screen`, `${part}harness-header`]) {
		const states = scenario.states.map((state) => ({
			...state,
			units: state.units?.filter((unit) => unit !== id)
		}));
		expect([id, scenarioFor({ ...scenario, states }, id, units).states]).toEqual([id, []]);
	}
});

test('each state names the one page it is reached on, and the code written for it', () => {
	const every = scenario.states.map((state) => state.id);
	expect(every).toHaveLength(48);
	const pages = new Set(units.filter((unit) => unit.kind === 'page').map((unit) => unit.id));
	const named = new Map(written);
	// The pieces a state shows are judged against its captures; its page and code are written here.
	const anchors = (ids: string[]) => ids.filter((id) => pages.has(id) || !visual(id)).sort();
	for (const state of scenario.states) {
		const own = anchors(state.units ?? []);
		const page = own.filter((id) => pages.has(id));
		const wanted = named.get(state.id);
		expect([state.id, page.length, own]).toEqual([state.id, 1, wanted ? anchors(wanted) : page]);
	}
	// The later states are exactly these, in this order.
	const later = scenario.states.filter((state) => named.has(state.id));
	expect(later.map((state) => state.id)).toEqual(written.map(([id]) => id));
	const registered = new Set(units.map((unit) => unit.id));
	const stated = scenario.states.flatMap((state) => state.units ?? []);
	expect(written.flatMap(([, ids]) => ids).filter((id) => !registered.has(id))).toEqual([]);
	expect(stated.filter((id) => !registered.has(id))).toEqual([]);
});
