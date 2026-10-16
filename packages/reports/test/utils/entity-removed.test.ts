import { expect, test } from 'vitest';
import { entityRemoved } from '../../src/utils/entityRemoved';
import { record, revision } from '../entityFixture';
import { answers, view } from '../entityPlaces';
import { commits, ids, scenarios } from '../entityUnits';

/** The selected commit with its scenarios declared anew, beside the parent as it was. */
function declaring(changed: typeof scenarios) {
	const head = revision(commits.middle, [record(commits.middle, false)]);
	head.registry = { ...head.registry, scenarios: changed };
	return answers(view('commit', { head }), ids.page).evidence;
}

test('a state the commit no longer declares is told as gone, with the scenario it was of', () => {
	const without = scenarios.map((scenario) => ({
		...scenario,
		states: scenario.states.filter((state) => state.id !== 'empty')
	}));
	expect(entityRemoved(declaring(without))).toEqual([
		'Orders page over synthetic orders: the state empty.'
	]);
});

test('a scenario the commit no longer declares is told as gone with every state it had', () => {
	const without = scenarios.filter((scenario) => scenario.id !== 'orders-page');
	expect(entityRemoved(declaring(without))).toEqual([
		'Orders page over synthetic orders: the scenario, with its states default, empty, denied.'
	]);
});

test('nothing is gone where both sides declare the same, and at a branch tip', () => {
	expect(entityRemoved(declaring(scenarios))).toEqual([]);
	expect(entityRemoved(answers(view('current'), ids.page).evidence)).toEqual([]);
});
