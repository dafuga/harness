import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { activityDisplay } from '../../src/components/projects-sessions/activity-agents/activityDisplay';
import { commitHref } from '../../src/components/projects-sessions/project-activity/activityDisplay';
import { plural } from '../../src/helpers/strings/plural';
import { agentStates, activityTime } from '../../src/utils/projects-sessions/activityDisplay';
import type { Roster } from './reports.function.activity-display.test.types';

const UNIT_ID = 'reports.function.activity-display';
const UNKNOWN = 'No agent has registered in this repository, so who is working is not known.';
const SINGULAR = 'registered agent is working now. Agents that do not register are not counted.';
const PLURAL = 'registered agents are working now. Agents that do not register are not counted.';
const BASE = 'https://reports.example.test';
const COMMIT = '3f2a6b8c1d4e5f60718293a4b5c6d7e8f9012345';

const roster = (working: number | null): Roster => ({ working }) as Roster;

test('Agent wording is singular for one, unknown for null', () => {
	const outputs = [roster(1), roster(2), roster(null)].map((input) => activityDisplay(input));
	expect(outputs).toEqual([SINGULAR, PLURAL, UNKNOWN]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'activityDisplay',
			state: 'agent-wording-is-singular-for-one-unknown-for-null',
			evidence: 'examples-cases',
			file: 'agent-wording-is-singular-for-one-unknown-for-null.json'
		},
		[
			{ name: 'one registered agent is working', input: { working: 1 }, output: SINGULAR },
			{ name: 'two registered agents are working', input: { working: 2 }, output: PLURAL },
			{ name: 'no agent has registered', input: { working: null }, output: UNKNOWN }
		]
	);
});

test('Agent state labels name all five states', () => {
	const expected = {
		working: 'Working',
		stale: 'Stale',
		gone: 'Process ended',
		completed: 'Finished',
		failed: 'Failed'
	};
	expect(agentStates).toEqual(expected);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'agentStates',
			state: 'agent-state-labels-name-all-five-states',
			evidence: 'examples-cases',
			file: 'agent-state-labels-name-all-five-states.json'
		},
		[{ name: 'fixed label table for every agent state', input: 'AgentState', output: expected }]
	);
});

test('Activity time shows UTC minute and keeps invalid input', () => {
	const valid = activityTime('2026-03-18T14:27:43.000Z');
	const invalid = activityTime('not-a-date');
	expect(valid).toBe('2026-03-18 14:27');
	expect(invalid).toBe('not-a-date');
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'activityTime',
			state: 'activity-time-shows-utc-minute-and-keeps-invalid-input',
			evidence: 'examples-cases',
			file: 'activity-time-shows-utc-minute-and-keeps-invalid-input.json'
		},
		[
			{
				name: 'UTC timestamp drops seconds and zone',
				input: '2026-03-18T14:27:43.000Z',
				output: valid
			},
			{ name: 'invalid date returns input unchanged', input: 'not-a-date', output: invalid }
		]
	);
});

test('Plural adds s except for exactly one', () => {
	const one = plural(1, 'agent');
	const two = plural(2, 'agent');
	const zero = plural(0, 'commit');
	expect([one, two, zero]).toEqual(['1 agent', '2 agents', '0 commits']);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'plural',
			state: 'plural-adds-s-except-for-exactly-one',
			evidence: 'examples-cases',
			file: 'plural-adds-s-except-for-exactly-one.json'
		},
		[
			{ name: 'count of one stays singular', input: { count: 1, word: 'agent' }, output: one },
			{ name: 'count of two takes s', input: { count: 2, word: 'agent' }, output: two },
			{ name: 'count of zero takes s', input: { count: 0, word: 'commit' }, output: zero }
		]
	);
});

test('Commit history link joins base, commit and first branch', () => {
	const withMain = commitHref(BASE, COMMIT, ['main']);
	const withRelease = commitHref(BASE, COMMIT, ['release/1.4']);
	const noBranch = commitHref(BASE, COMMIT, []);
	expect(withMain.startsWith(BASE)).toBe(true);
	expect(withMain).toContain(COMMIT);
	expect(withMain).toContain('main');
	expect(withRelease).toContain(COMMIT);
	expect(noBranch.startsWith(BASE)).toBe(true);
	expect(noBranch).toContain(COMMIT);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'commitHref',
			state: 'commit-history-link-joins-base-commit-and-first-branch',
			evidence: 'examples-cases',
			file: 'commit-history-link-joins-base-commit-and-first-branch.json'
		},
		[
			{
				name: 'first branch is main',
				input: { base: BASE, commit: COMMIT, branches: ['main'] },
				output: withMain
			},
			{
				name: 'first branch is release/1.4',
				input: { base: BASE, commit: COMMIT, branches: ['release/1.4'] },
				output: withRelease
			},
			{
				name: 'no branches gives null branch',
				input: { base: BASE, commit: COMMIT, branches: [] },
				output: noBranch
			}
		]
	);
});
