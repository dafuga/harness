import { expect, test } from 'vitest';
import type { HarnessScenario } from '../../src/models/explorer-ui/Harness.types';
import { scenarioFor } from '../../src/utils/explorer-ui/explorerState';
import { declared, unit } from '../explorerFixture';

// The planning-artifacts shape: two shared headless states that name no unit, and one state that
// names the downstream units which read the object. The dependency that reads it is not named.
const plan = 'planning.function.plan-read';
const reads = 'planning.function.plan-reads';
const service = 'planning.service.planning';
const git = 'planning.function.plan-git';
const owned = [reads, service, git];

const registry = [
	unit(plan, 'function'),
	unit(reads, 'function', { dependencies: [{ unit: plan, via: 'import' }] }),
	unit(service, 'service', { dependencies: [{ unit: reads, via: 'import' }] }),
	unit(git, 'function', { dependencies: [{ unit: plan, via: 'import' }] })
];

const headless = (viewports: HarnessScenario['viewports'] = []) =>
	declared({
		id: 'planning-artifacts',
		title: 'Planning artifacts',
		kind: 'headless',
		units: [plan, reads, service, git],
		states: [
			{ id: 'immutable-history', coverage: 'required' },
			{ id: 'repository-isolation', coverage: 'required' },
			{ id: 'operation-read-isolation', coverage: 'required', units: owned }
		],
		viewports,
		evidence: [
			{
				id: 'planning-artifacts-output',
				kind: 'output',
				states: ['immutable-history', 'repository-isolation', 'operation-read-isolation'],
				viewports: []
			}
		]
	});

const ids = (scenario: HarnessScenario, target: string) =>
	scenarioFor(scenario, target, registry).states.map((state) => state.id);

test('a headless unit keeps the shared unowned states its dependant does not own', () => {
	// The downstream state belongs to plan-reads, service and plan-git; plan-read itself shows the
	// two shared states the guide attributes to it, not the state those dependants own.
	expect(ids(headless(), plan)).toEqual(['immutable-history', 'repository-isolation']);
});

test('an explicit owner keeps only the states that name it', () => {
	expect(ids(headless(), reads)).toEqual(['operation-read-isolation']);
	expect(ids(headless(), git)).toEqual(['operation-read-isolation']);
});

test('a headless scenario with viewports keeps the dependant rule for its states', () => {
	const viewported = headless([{ id: 'desktop', width: 1440, height: 900 }]);
	expect(ids(viewported, plan)).toEqual(['operation-read-isolation']);
});
