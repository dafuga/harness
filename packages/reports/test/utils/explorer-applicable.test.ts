import { expect, test } from 'vitest';
import type { ExplorerScope } from '../../src/models/Explorer.types';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import { explorerVerdict } from '../../src/utils/explorer-verdict/explorerVerdict';
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

const [catalog, entity, route] = [
	unit('page.functions', 'page'),
	unit('page.function', 'page'),
	unit('function.route', 'function')
];
const shot = (state: string) => capture({ state, sha256: state.padEnd(64, '0') });
// One scenario of two screens: each state says which page it shows; the function is under both.
const scenario = declared({
	id: 'explorer',
	title: 'Explorer',
	units: ['page.functions', 'page.function', 'function.route'],
	states: [
		{ id: 'catalog', coverage: 'required', units: ['page.functions'] },
		{ id: 'entity', coverage: 'required', units: ['page.function'] }
	],
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	tests: [{ id: 'flow', kind: 'e2e', runner: 'playwright' }],
	evidence: [
		{ id: 'screens', kind: 'screenshot', states: ['catalog', 'entity'], viewports: ['desktop'] }
	]
});
const tests = [
	{ id: 'explorer:flow', kind: 'e2e', target: 'flow', status: 'passed' as const, durationMs: 1 }
];
/** A record that captured the named states and no other. */
const recorded = (...states: string[]) =>
	record(
		[
			result([], {
				id: 'explorer',
				states: states.map((id) => ({ id, coverage: 'required', captures: [shot(id)] }))
			})
		],
		{ tests }
	);
const at = (...states: string[]) =>
	revision([catalog, entity, route], [scenario], [recorded(...states)]);
const scope: ExplorerScope = {
	location: { branch: 'main', commit: null, category: 'pages' },
	mode: 'current',
	branch: 'main',
	tip: sha('a'),
	commit: sha('a'),
	atTip: true,
	parent: null,
	summary: summary(sha('a'))
};

test('a page is proven by the states that show it, whatever the other states of the scenario are', () => {
	const head = at('catalog');
	expect(explorerVerdict(catalog, head).passed).toBe(true);
	expect(explorerVerdict(entity, head)).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	expect(explorerVerdict(entity, head).reasons.join(' ')).toContain('entity');
	expect(explorerVerdict(entity, head).reasons.join(' ')).not.toContain('catalog');
});

test('a unit that no state names is under every state, and needs them all', () => {
	expect(explorerVerdict(route, at('catalog')).passed).toBe(false);
	expect(explorerVerdict(route, at('catalog', 'entity')).passed).toBe(true);
});

test('a page is shown with its own states and captures only', () => {
	const shown = explorerEvidence(scope, { head: at('catalog', 'entity'), parent: null }, entity);
	expect(shown.scenarios[0].states.map((state) => state.id)).toEqual(['entity']);
	expect(shown.after.captures.map((item) => item.state)).toEqual(['entity']);
	expect(shown.after.coverage[0].states.map((state) => state.state)).toEqual(['entity']);
	const whole = explorerEvidence(scope, { head: at('catalog', 'entity'), parent: null }, route);
	expect(whole.scenarios[0].states.map((state) => state.id)).toEqual(['catalog', 'entity']);
	expect(whole.after.captures.map((item) => item.state)).toEqual(['catalog', 'entity']);
});

test('a page whose only states cannot occur has nothing that proves it', () => {
	const none = declared({
		...scenario,
		states: [
			{ id: 'catalog', coverage: 'required', units: ['page.functions'] },
			{ id: 'entity', coverage: 'inapplicable', reason: 'Never shown.', units: ['page.function'] }
		],
		evidence: [{ id: 'screens', kind: 'screenshot', states: ['catalog'], viewports: ['desktop'] }]
	});
	const head = revision([catalog, entity], [none], [recorded('catalog')]);
	expect(explorerVerdict(entity, head)).toMatchObject({
		passed: false,
		label: 'Coverage incomplete'
	});
	expect(explorerVerdict(catalog, head).passed).toBe(true);
});
