import { test } from 'vitest';
import { agentLiveness } from '../../src/services/agents-providers/agent-activity-service/agentLiveness';
import type { AgentFacts, ProcessFacts } from '../../src/utils/agents-providers/agentLiveness';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each state calls agentLiveness as the activity service's roster does: an agent's registration
 * and heartbeat facts, the assessment time and a process probe. The probe answers from a table and
 * keeps each number it was asked about, so a state shows when its process was consulted and when
 * it was not. Each case records what was given and what came back.
 */

const msAt = (iso: string): number => Date.parse(iso);

const registration: AgentFacts = {
	registeredAt: '2026-11-15T10:00:00.000Z',
	heartbeatAt: '2026-11-15T10:05:00.000Z',
	ttlSeconds: 30,
	pid: 4182,
	processStartedAt: '2026-11-15T09:58:00.000Z',
	finished: null
};
/** An agent that named no process, with a 60-second allowance between heartbeats. */
const unnamed: AgentFacts = { ...registration, ttlSeconds: 60, pid: null, processStartedAt: null };

/**
 * Calls agentLiveness with a probe that answers from the table. Returns the result and the
 * process numbers the probe was asked about, in order.
 */
function assess(agent: AgentFacts, now: number, processes: Partial<Record<number, ProcessFacts>>) {
	const asked: number[] = [];
	const output = agentLiveness(agent, now, (pid) => {
		asked.push(pid);
		return processes[pid] ?? { exists: false, startedAt: null };
	});
	return { output, asked };
}

test('Reports a final record as its end state', () => {
	const finishedAt = '2026-11-15T10:06:00.000Z';
	const exited = { 4182: { exists: false, startedAt: null } };
	const failed: AgentFacts = { ...registration, finished: { status: 'failed', at: finishedAt } };
	const completed: AgentFacts = {
		...registration,
		finished: { status: 'completed', at: finishedAt }
	};
	const failedCall = assess(failed, msAt(finishedAt), exited);
	const completedCall = assess(completed, msAt(finishedAt), exited);
	expect(failedCall.output).toEqual({ state: 'failed', detail: `Failed at ${finishedAt}` });
	expect(completedCall.output).toEqual({ state: 'completed', detail: `Finished at ${finishedAt}` });
	// The final record settles the agent before its process is asked about.
	expect(failedCall.asked).toEqual([]);
	expect(completedCall.asked).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.agent-liveness',
			symbol: 'agentLiveness',
			state: 'reports-a-final-record-as-its-end-state',
			evidence: 'examples-cases',
			file: 'reports-a-final-record-as-its-end-state.json'
		},
		[
			{
				name: 'a failed record is the end state, and its exited process is not asked about',
				input: { agent: failed, now: msAt(finishedAt), processes: exited },
				output: failedCall.output
			},
			{
				name: 'a completed record is the end state, and its exited process is not asked about',
				input: { agent: completed, now: msAt(finishedAt), processes: exited },
				output: completedCall.output
			}
		]
	);
});

test('Reports an agent gone when its process ended or was reused', () => {
	const now = msAt(registration.heartbeatAt);
	const ended = { 4182: { exists: false, startedAt: null } };
	const reused = { 4182: { exists: true, startedAt: '2026-11-15T10:01:00.000Z' } };
	const endedCall = assess(registration, now, ended);
	const reusedCall = assess(registration, now, reused);
	expect(endedCall.output).toEqual({
		state: 'gone',
		detail: 'Its process 4182 ended without saying it finished'
	});
	expect(reusedCall.output).toEqual({
		state: 'gone',
		detail: 'Process 4182 is another process now; the one that registered has ended'
	});
	expect(endedCall.asked).toEqual([4182]);
	expect(reusedCall.asked).toEqual([4182]);
	recordExampleCases(
		{
			unitId: 'function.agent-liveness',
			symbol: 'agentLiveness',
			state: 'reports-an-agent-gone-when-its-process-ended-or-was-reused',
			evidence: 'examples-cases',
			file: 'reports-an-agent-gone-when-its-process-ended-or-was-reused.json'
		},
		[
			{
				name: 'the process ended without saying it finished, though the heartbeat is current',
				input: { agent: registration, now, processes: ended },
				output: endedCall.output
			},
			{
				name: 'the number now belongs to a process that started after the agent registered',
				input: { agent: registration, now, processes: reused },
				output: reusedCall.output
			}
		]
	);
});

test('Reports a heartbeat older than its allowance as stale', () => {
	const quiet: AgentFacts = { ...registration, heartbeatAt: '2026-11-15T10:00:00.000Z' };
	const quietAt = msAt('2026-11-15T10:00:31.000Z');
	const running = { 4182: { exists: true, startedAt: registration.processStartedAt } };
	const silentAt = msAt('2026-11-15T10:06:01.000Z');
	const quietCall = assess(quiet, quietAt, running);
	const silentCall = assess(unnamed, silentAt, {});
	expect(quietCall.output).toEqual({
		state: 'stale',
		detail: 'No heartbeat since 2026-11-15T10:00:00.000Z; it allowed 30 seconds between heartbeats'
	});
	expect(silentCall.output).toEqual({
		state: 'stale',
		detail: 'No heartbeat since 2026-11-15T10:05:00.000Z; it allowed 60 seconds between heartbeats'
	});
	// A process that still exists proves no work, so only the heartbeat decides.
	expect(quietCall.asked).toEqual([4182]);
	expect(silentCall.asked).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.agent-liveness',
			symbol: 'agentLiveness',
			state: 'reports-a-heartbeat-older-than-its-allowance-as-stale',
			evidence: 'examples-cases',
			file: 'reports-a-heartbeat-older-than-its-allowance-as-stale.json'
		},
		[
			{
				name: 'the process still exists, but the heartbeat is 31 seconds older than the 30-second allowance',
				input: { agent: quiet, now: quietAt, processes: running },
				output: quietCall.output
			},
			{
				name: 'no process was named, and the heartbeat is 61 seconds older than the 60-second allowance',
				input: { agent: unnamed, now: silentAt, processes: {} },
				output: silentCall.output
			}
		]
	);
});

test('Reports a heartbeat within its allowance as working', () => {
	const detail = `Last heartbeat at ${registration.heartbeatAt}`;
	const running = { 4182: { exists: true, startedAt: registration.processStartedAt } };
	const unanswered = { 4182: { exists: undefined, startedAt: null } };
	const currentAt = msAt(registration.heartbeatAt);
	const boundaryAt = msAt('2026-11-15T10:06:00.000Z');
	const lateAt = msAt('2026-11-15T10:05:10.000Z');
	const liveCall = assess(registration, currentAt, running);
	const boundaryCall = assess(unnamed, boundaryAt, {});
	const unansweredCall = assess(registration, lateAt, unanswered);
	expect(liveCall.output).toEqual({ state: 'working', detail });
	expect(boundaryCall.output).toEqual({ state: 'working', detail });
	expect(unansweredCall.output).toEqual({ state: 'working', detail });
	expect(liveCall.asked).toEqual([4182]);
	expect(boundaryCall.asked).toEqual([]);
	expect(unansweredCall.asked).toEqual([4182]);
	recordExampleCases(
		{
			unitId: 'function.agent-liveness',
			symbol: 'agentLiveness',
			state: 'reports-a-heartbeat-within-its-allowance-as-working',
			evidence: 'examples-cases',
			file: 'reports-a-heartbeat-within-its-allowance-as-working.json'
		},
		[
			{
				name: 'the process exists with the start time it registered with, and the heartbeat is current',
				input: { agent: registration, now: currentAt, processes: running },
				output: liveCall.output
			},
			{
				name: 'the heartbeat is exactly 60 seconds old, which the 60-second allowance still covers',
				input: { agent: unnamed, now: boundaryAt, processes: {} },
				output: boundaryCall.output
			},
			{
				name: 'the process could not be asked, so it is not gone; exists is undefined and recorded as null',
				input: {
					agent: registration,
					now: lateAt,
					processes: { 4182: { exists: null, startedAt: null } }
				},
				output: unansweredCall.output
			}
		]
	);
});
