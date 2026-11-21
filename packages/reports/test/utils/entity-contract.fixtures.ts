import type { HarnessScenario, HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import { ids, scenarios, units } from '../entityUnits';

const page = units.find((unit) => unit.id === ids.page)!;

export const made = (id: string, uses: string[] = []): HarnessUnit => ({
	...page,
	id,
	kind: id.startsWith('page.')
		? 'page'
		: ({ shared: 'component', endpoint: 'endpoint' }[id] ?? 'function'),
	dependencies: uses.map((unit) => ({ unit, via: 'import' }))
});
// Three pages: two are made of one shared component, and an endpoint is behind none of them.
export const registry = [
	made('page.a', ['shared']),
	made('page.b', ['shared']),
	made('page.c'),
	made('shared', ['helper']),
	made('helper'),
	made('endpoint')
];
export const screens: HarnessScenario = {
	...scenarios[0],
	id: 'screens',
	units: registry.map((unit) => unit.id),
	states: [
		{ id: 'a', coverage: 'required', units: ['page.a'] },
		{ id: 'a-empty', coverage: 'required', units: ['page.a'] },
		{ id: 'a-denied', coverage: 'inapplicable', reason: 'no sign-in', units: ['page.a'] },
		{ id: 'b', coverage: 'required', units: ['page.b'] },
		{ id: 'c', coverage: 'required', units: ['page.c'] }
	]
};
