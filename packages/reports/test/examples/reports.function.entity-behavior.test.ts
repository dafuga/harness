import { test } from 'vitest';
import { behaviorDuration, entityBehavior } from '../../src/utils/explorer-ui/entityBehavior';
import type { EntityBehavior } from '../../src/utils/explorer-ui/entityBehavior';
import { record, revision } from '../entityFixture';
import { answers, view } from '../entityPlaces';
import { commits, ids } from '../entityUnits';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Changed, Case } from './reports.function.entity-behavior.test.types';

const unitId = 'reports.function.entity-behavior';
const shown = (mode: 'current' | 'commit', changed: Changed = {}) =>
	entityBehavior(answers(view(mode, changed), ids.filter).behavior);

/** The parts of a display model a reader sees: its wording, flags, each state's outcomes and reasons. */
const summaryOf = (run: EntityBehavior) => ({
	label: run.label,
	recorded: run.recorded,
	passed: run.passed,
	unknown: run.unknown,
	groups: run.groups.map((group) => [group.scenario, group.state, group.before, group.after]),
	reasons: run.reasons
});

/** Records the named checks of one state as a trace of their inputs and actual results. */
function traceCases(symbol: string, state: string, list: Array<[string, unknown, unknown]>) {
	const cases: Case[] = list.map(([name, input, output]) => ({ name, input, output }));
	return recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

const tipState = 'entity-behavior-tip-run-each-state-passed';
test('the branch tip shows one passing run, each state with what it recorded', () => {
	const run = shown('current');
	expect(run).toMatchObject({
		mode: 'current',
		label: 'Current behavior',
		recorded: true,
		passed: true,
		unknown: false
	});
	expect(run.groups.map((group) => [group.scenario, group.state, group.after])).toEqual([
		['order-filter', 'match', 'passed'],
		['order-filter', 'no-match', 'passed']
	]);
	expect(run.groups[0].lines.map((line) => line.kind)).toEqual(['assertions', 'output']);
	expect(run.reasons).toEqual([]);
	traceCases('entityBehavior', tipState, [
		['tip run lists both states', { mode: 'current' }, summaryOf(run)],
		['match state lines', { state: 'match' }, run.groups[0].lines.map((line) => line.kind)]
	]);
});

const unchangedState = 'entity-behavior-commit-equal-results-unchanged';
test('equal results on both sides are behavior unchanged, with the host scenario titles', () => {
	const run = shown('commit');
	expect(run.label).toBe('Behavior unchanged');
	expect(run.passed).toBe(true);
	expect(run.unknown).toBe(false);
	expect(run.groups[0]).toMatchObject({ before: 'passed', after: 'passed' });
	expect(run.reasons).toEqual([]);
	expect(run.scenarios).toEqual([
		{
			id: 'order-filter',
			title: 'Search across synthetic orders',
			before: 'passed',
			after: 'passed'
		}
	]);
	traceCases('entityBehavior', unchangedState, [
		['equal results are unchanged', { mode: 'commit' }, summaryOf(run)],
		['scenario titles are the host own', { scenario: 'order-filter' }, run.scenarios]
	]);
});

const bytesState = 'entity-behavior-commit-other-bytes-not-yet-a-change';
test('results with other bytes are not yet called a change: only what they hold says that', () => {
	const altered = record(commits.middle);
	altered.scenarios[1].states[0].captures[1].sha256 = 'e'.repeat(64);
	const run = shown('commit', { head: revision(commits.middle, [altered]) });
	expect(run.label).toBe('Recorded results differ');
	expect(run.unknown).toBe(true);
	expect(run.reasons).toHaveLength(1);
	expect(run.reasons[0]).toMatch(/differ in bytes/);
	traceCases('entityBehavior', bytesState, [
		['other bytes stay unknown', { sha256: 'altered' }, summaryOf(run)],
		['reason is said once', { reasons: run.reasons.length }, run.reasons]
	]);
});

const unreadState = 'entity-behavior-commit-unread-results-keep-no-read';
test('unread results keep their cells without a read, and the change stays unknown', () => {
	const altered = record(commits.middle);
	altered.scenarios[1].states[0].captures[1].sha256 = 'e'.repeat(64);
	const run = shown('commit', { head: revision(commits.middle, [altered]) });
	const [assertions, output] = run.groups[0].lines;
	expect(run).toMatchObject({ label: 'Recorded results differ', unknown: true });
	expect(output.kind).toBe('output');
	expect(output.after.outcome).toBe('passed');
	expect('read' in output.after).toBe(false);
	expect('read' in assertions.after).toBe(false);
	traceCases('entityBehavior', unreadState, [
		['unread differing bytes stay unknown', { mode: 'commit' }, summaryOf(run)],
		['unread cell has no read', { side: 'after' }, { read: 'read' in output.after }]
	]);
});

const missingState = 'entity-behavior-commit-parent-missing-is-unknown';
test('a parent that recorded nothing leaves the change unknown, never unchanged', () => {
	const run = shown('commit', { parent: revision(commits.first, []) });
	expect(run.label).toBe('Behavior unknown');
	expect(run.unknown).toBe(true);
	expect(run.passed).toBe(true);
	expect(run.groups[0].before).toBe('missing');
	expect(run.groups[0].lines[0].before).toEqual({ outcome: 'missing', capture: null });
	expect(run.reasons.length).toBeGreaterThan(0);
	traceCases('entityBehavior', missingState, [
		['missing parent is unknown', { parent: 'empty' }, summaryOf(run)],
		['missing side is a null capture', { side: 'before' }, run.groups[0].lines[0].before]
	]);
});

const failedState = 'entity-behavior-current-failed-scenario-not-passed';
test('a run whose scenario failed is not passed, whatever results remain listed', () => {
	const failing = record(commits.tip);
	failing.scenarios[1].states[0].captures[0].status = 'failed';
	failing.scenarios[1].status = 'failed';
	const run = shown('current', { head: revision(commits.tip, [failing]) });
	expect(run.passed).toBe(false);
	expect(run.scenarios[0].after).toBe('failed');
	traceCases('entityBehavior', failedState, [
		['failed scenario is not passed', { scenario: 'order-filter' }, summaryOf(run)],
		['scenario after status', { field: 'after' }, run.scenarios[0].after]
	]);
});

const noneState = 'entity-behavior-current-no-end-to-end-result';
test('an entity with no recorded end-to-end result says so and is not passed', () => {
	const run = shown('current', { head: revision(commits.tip, []) });
	expect(run).toMatchObject({ recorded: false, passed: false, unknown: true, groups: [] });
	expect(run.label).toBe('No end-to-end result is recorded');
	traceCases('entityBehavior', noneState, [
		['no recorded result is said so', { mode: 'current' }, summaryOf(run)]
	]);
});

const durationState = 'entity-behavior-duration-sums-named-e2e-jobs';
test('the duration sums only the end-to-end jobs whose id names a listed scenario', () => {
	const found = record(commits.middle);
	expect(behaviorDuration(found, ['order-filter'])).toBe('40 ms');
	expect(behaviorDuration(found, ['orders-page', 'order-filter'])).toBe('940 ms');
	traceCases('behaviorDuration', durationState, [
		[
			'one named scenario job',
			{ scenarios: ['order-filter'] },
			behaviorDuration(found, ['order-filter'])
		],
		[
			'two named scenario jobs',
			{ scenarios: ['orders-page', 'order-filter'] },
			behaviorDuration(found, ['orders-page', 'order-filter'])
		]
	]);
});

const absentState = 'entity-behavior-duration-missing-jobs-give-null';
test('no duration is made up: a null record, empty list, bare id or non-e2e job gives null', () => {
	const found = record(commits.middle);
	const bare = { ...found, tests: [{ ...found.tests[1], id: 'order-filter' }] };
	const unit = {
		...found,
		tests: [{ ...found.tests[1], id: 'order-filter:filter-flow', kind: 'unit' }]
	};
	expect(behaviorDuration(null, ['order-filter'])).toBeNull();
	expect(behaviorDuration(found, [])).toBeNull();
	expect(behaviorDuration(found, ['order'])).toBeNull();
	expect(behaviorDuration(bare, ['order-filter'])).toBeNull();
	expect(behaviorDuration(unit, ['order-filter'])).toBeNull();
	traceCases('behaviorDuration', absentState, [
		['null record has no duration', { record: null }, behaviorDuration(null, ['order-filter'])],
		['empty list matches nothing', { scenarios: [] }, behaviorDuration(found, [])],
		['prefix without colon matches nothing', { id: 'order' }, behaviorDuration(found, ['order'])],
		[
			'bare id is not a scenario job',
			{ id: 'order-filter' },
			behaviorDuration(bare, ['order-filter'])
		],
		['unit test is not an e2e job', { kind: 'unit' }, behaviorDuration(unit, ['order-filter'])]
	]);
});
