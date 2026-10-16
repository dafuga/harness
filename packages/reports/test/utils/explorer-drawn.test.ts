import { expect, test } from 'vitest';
import type { ExplorerScope } from '../../src/models/Explorer.types';
import type { HarnessUnit } from '../../src/models/Harness.types';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import { explorerVerdict } from '../../src/utils/explorerVerdict';
import {
	capture,
	declared,
	record,
	result,
	revision,
	sha,
	summary,
	unit
} from '../explorerFixture';

const made = (id: string, kind: string, ...of: string[]) =>
	unit(id, kind, { dependencies: of.map((used) => ({ unit: used, via: 'import' })) });
// Two pages on one host. The catalog draws a table; the entity page draws a panel inside a frame.
// The host draws the header on both, and the endpoint is drawn by neither.
const units = [
	made('page.functions', 'page', 'component.host', 'component.table'),
	made('page.function', 'page', 'component.host', 'component.frame'),
	made('component.host', 'component', 'component.header'),
	made('component.frame', 'component', 'component.panel'),
	made('component.table', 'component'),
	made('component.panel', 'component'),
	made('component.header', 'component'),
	made('endpoint.data', 'endpoint')
];
const named = (id: string) => units.find((item) => item.id === id) as HarnessUnit;
const states = [
	{ id: 'catalog', coverage: 'required' as const, units: ['page.functions'] },
	{ id: 'entity', coverage: 'required' as const, units: ['page.function'] }
];
// Every state says which page it is a state of, and nothing about what that page is made of.
const scenario = declared({
	id: 'explorer',
	title: 'Explorer',
	units: units.map((item) => item.id),
	states,
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	tests: [{ id: 'flow', kind: 'e2e', runner: 'playwright' }],
	evidence: [
		{ id: 'screens', kind: 'screenshot', states: ['catalog', 'entity'], viewports: ['desktop'] }
	]
});
const tests = [
	{ id: 'explorer:flow', kind: 'e2e', target: 'flow', status: 'passed' as const, durationMs: 1 }
];
const shot = (state: string) => capture({ state, sha256: state.padEnd(64, '0') });
/** A revision whose record captured the named states and no other. */
const at = (captured: string[], contract = scenario, registry = units) =>
	revision(
		registry,
		[contract],
		[
			record(
				[
					result([], {
						id: 'explorer',
						states: captured.map((id) => ({ id, coverage: 'required', captures: [shot(id)] }))
					})
				],
				{ tests }
			)
		]
	);
const scope: ExplorerScope = {
	location: { branch: 'main', commit: null, category: 'components' },
	mode: 'current',
	branch: 'main',
	tip: sha('a'),
	commit: sha('a'),
	atTip: true,
	parent: null,
	summary: summary(sha('a'))
};
const shown = (id: string, head = at(['catalog', 'entity'])) =>
	explorerEvidence(scope, { head, parent: null }, named(id));
const statesOf = (id: string, head?: ReturnType<typeof at>) =>
	shown(id, head).scenarios[0].states.map((state) => state.id);

test('a component is shown by the states of the pages that draw it, through any depth', () => {
	expect(statesOf('component.table')).toEqual(['catalog']);
	expect(statesOf('component.frame')).toEqual(['entity']);
	expect(statesOf('component.panel')).toEqual(['entity']);
	expect(shown('component.panel').after.captures.map((item) => item.state)).toEqual(['entity']);
	expect(shown('component.panel').after.coverage[0].states.map((item) => item.state)).toEqual([
		'entity'
	]);
});

test('what every page draws is under every state, and so is what no page draws', () => {
	expect(statesOf('component.host')).toEqual(['catalog', 'entity']);
	expect(statesOf('component.header')).toEqual(['catalog', 'entity']);
	expect(statesOf('endpoint.data')).toEqual(['catalog', 'entity']);
});

test('a component is proven by the states that draw it and needs no other', () => {
	const head = at(['catalog']);
	expect(explorerVerdict(named('component.table'), head).passed).toBe(true);
	expect(explorerVerdict(named('component.panel'), head)).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	expect(explorerVerdict(named('component.header'), head).passed).toBe(false);
	expect(explorerVerdict(named('component.header'), at(['catalog', 'entity'])).passed).toBe(true);
});

test('what draws a component is read from the registry of the revision, not assumed', () => {
	// The same contract over a registry in which the entity page draws the table too.
	const moved = units.map((item) =>
		item.id === 'page.function'
			? made('page.function', 'page', 'component.host', 'component.frame', 'component.table')
			: item
	);
	expect(statesOf('component.table', at(['catalog', 'entity'], scenario, moved))).toEqual([
		'catalog',
		'entity'
	]);
	expect(explorerVerdict(named('component.table'), at(['catalog'], scenario, moved)).passed).toBe(
		false
	);
});

test('a state that names a component says so itself: where else it is drawn adds nothing', () => {
	const explicit = declared({
		...scenario,
		states: [states[0], { ...states[1], units: ['page.function', 'component.table'] }]
	});
	expect(statesOf('component.table', at(['catalog', 'entity'], explicit))).toEqual(['entity']);
});
