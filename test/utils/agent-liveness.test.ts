import { expect, test } from 'vitest';
import { agentLiveness, type AgentFacts, type ProcessFacts } from '../../src/utils/agentLiveness';

const now = Date.parse('2026-10-11T12:00:00.000Z');
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
const started = 'Sun Oct 11 10:07:29 2026';
const agent = (changes: Partial<AgentFacts> = {}): AgentFacts => ({
	registeredAt: ago(3600),
	heartbeatAt: ago(30),
	ttlSeconds: 900,
	pid: null,
	processStartedAt: null,
	finished: null,
	...changes
});
const running: ProcessFacts = { exists: true, startedAt: started };
const state = (facts: AgentFacts, found: ProcessFacts = running) =>
	agentLiveness(facts, now, () => found).state;

test('an agent is working only while its own heartbeat is fresh', () => {
	expect(state(agent())).toBe('working');
	expect(state(agent({ heartbeatAt: ago(900) }))).toBe('working');
	const quiet = agentLiveness(agent({ heartbeatAt: ago(901) }), now, () => running);
	expect(quiet.state).toBe('stale');
	expect(quiet.detail).toContain('2026-10-11T11:44:59');
	// A process that is still there proves nothing about work: the heartbeat decides.
	const idle = agent({ heartbeatAt: ago(7200), pid: 4242, processStartedAt: started });
	expect(state(idle)).toBe('stale');
});

test('a finished or failed owner stays finished, whatever arrives after', () => {
	const done = { status: 'completed' as const, at: ago(60) };
	expect(state(agent({ finished: done }))).toBe('completed');
	expect(state(agent({ finished: done, heartbeatAt: ago(1) }))).toBe('completed');
	expect(state(agent({ finished: { status: 'failed', at: ago(60) } }))).toBe('failed');
});

test('a process that ended, or a number that now belongs to another process, is not the agent', () => {
	const owned = agent({ pid: 4242, processStartedAt: started });
	expect(state(owned)).toBe('working');
	expect(state(owned, { exists: false, startedAt: null })).toBe('gone');
	const reused = agentLiveness(owned, now, () => ({
		exists: true,
		startedAt: 'Sun Oct 11 11:30:00 2026'
	}));
	expect(reused.state).toBe('gone');
	expect(reused.detail).toMatch(/another process/);
	// Where the start of a process cannot be read, only its absence is evidence.
	expect(state(agent({ pid: 4242 }), { exists: true, startedAt: null })).toBe('working');
	expect(state(owned, { exists: undefined, startedAt: null })).toBe('working');
	// A registration without a process is judged by its heartbeat alone, and nothing is asked.
	let asked = 0;
	agentLiveness(agent(), now, () => {
		asked += 1;
		return running;
	});
	expect(asked).toBe(0);
});
