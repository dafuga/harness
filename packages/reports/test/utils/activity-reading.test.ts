import { expect, test } from 'vitest';
import { activityReading } from '../../src/utils/activityReading';
import { activityPayload, manyAgents } from '../../tests/e2e/support/activityPayload';

const at = Date.parse('2026-10-11T12:00:00.000Z');

test('a reading that grew old stops saying who is working', () => {
	const { agents, sampledAt } = activityPayload(at, [
		...manyAgents.slice(0, 2),
		{ label: 'Lapsed', state: 'working', expiresAt: new Date(at + 10_000).toISOString() }
	]).live;
	const fresh = activityReading(agents as never, sampledAt, at + 5_000);
	expect([fresh.current, fresh.working]).toEqual([true, 3]);
	expect(agents.roster.map((agent) => fresh.label(agent as never))).toEqual([
		'Working',
		'Working',
		'Working'
	]);
	// An agent whose own allowance ran out is stale, without asking the server again.
	const later = activityReading(agents as never, sampledAt, at + 30_000);
	expect([later.current, later.working]).toEqual([true, 2]);
	expect(later.label(agents.roster[2] as never)).toBe('Stale');
	// A reading older than a minute says nothing about now: nobody is counted or called working.
	const old = activityReading(agents as never, sampledAt, at + 61_000);
	expect([old.current, old.working]).toEqual([false, null]);
	expect(agents.roster.map((agent) => old.label(agent as never))).toEqual([
		'Not confirmed',
		'Not confirmed',
		'Not confirmed'
	]);
	// A recorded outcome is not live state and does not age.
	expect(old.label({ ...agents.roster[0], state: 'completed' } as never)).toBe('Finished');
});
