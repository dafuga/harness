import type { HarnessRevision, HarnessScenario, HarnessUnit } from '../src/models/Harness.types';
import { record, revision } from './entityFixture';
import { commits, ids, scenarios, units } from './entityUnits';

/** A page of the synthetic app that is made of nothing the orders page is made of. */
export const otherPage = 'app.page.returns';

/**
 * The scenarios of the fixture with each state naming the page it is a state of, as a registry
 * that records it does, and one more required state that is a state of another page.
 */
export const namedScenarios: HarnessScenario[] = scenarios.map((scenario) =>
	scenario.id !== 'orders-page'
		? scenario
		: {
				...scenario,
				units: [...scenario.units, otherPage],
				states: [
					...scenario.states.map((state) => ({ ...state, units: [ids.page] })),
					{ id: 'returns', coverage: 'required', units: [otherPage] }
				]
			}
);

/** The units of the fixture with that other page, which uses none of them. */
export const namedUnits: HarnessUnit[] = [
	...units,
	{ ...units[0], id: otherPage, title: 'ReturnsPage', dependencies: [] }
];

/** A recorded revision whose registry says which page each state is a state of. */
export function namedRevision(commit: string, changed: Partial<HarnessRevision['registry']> = {}) {
	const found = revision(commit, [record(commit)]);
	const registry = { ...found.registry, scenarios: namedScenarios, units: namedUnits, ...changed };
	return { ...found, registry };
}

export const both = () => ({
	head: namedRevision(commits.middle),
	parent: namedRevision(commits.first)
});
