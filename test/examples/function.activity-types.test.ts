import { test } from 'vitest';
import { z } from 'zod';
import {
	agentBeatSchema,
	agentEndSchema,
	agentRegistrationSchema
} from '../../src/core/projects-sessions/activityTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each agent activity schema is called the way AgentRegistryRepository parses the file an agent
 * wrote. What it was given and what it returned, or why it refused, is asserted and recorded as
 * the cases of its state.
 */

const registration = {
	schemaVersion: 1,
	id: 'schema-review',
	label: 'Schema review',
	provider: 'claude',
	model: 'claude-haiku-5-5',
	pid: 48213,
	processStartedAt: '2026-11-15T09:12:00.000Z',
	registeredAt: '2026-11-15T09:12:02.000Z',
	ttlSeconds: 900
};
const unknownIdentity = {
	...registration,
	provider: null,
	model: null,
	pid: null,
	processStartedAt: null
};
const heartbeat = {
	at: '2026-11-15T09:14:30.000Z',
	branch: 'feature/examples',
	task: 'Write the activity examples',
	loop: 'activity-examples',
	units: ['function.activity-types']
};
const idleBeat = { at: heartbeat.at, branch: null, task: null, loop: null, units: [] };
const completion = {
	at: '2026-11-15T10:02:11.000Z',
	status: 'completed',
	outcome: 'Examples recorded'
};
const failure = { at: completion.at, status: 'failed', outcome: null };

type Parser = { parse(value: unknown): unknown };
type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

/** Parses each input as a caller does; a refusal is kept as the reasons the schema gives. */
function parsing(schema: Parser) {
	return (name: string, input: unknown): ExampleCase => {
		try {
			return { name, input, output: schema.parse(input) };
		} catch (error) {
			return { name, input, error: reasons(error) };
		}
	};
}

/** The path and message of each refusal, in the order zod gives them; the root is named record. */
function reasons(error: unknown): string[] {
	if (!(error instanceof z.ZodError)) throw error;
	return error.issues.map((issue) => {
		const where = issue.path.length > 0 ? issue.path.join('.') : 'record';
		return `${where}: ${issue.message}`;
	});
}

test('agentRegistrationSchema parsed a registration with a stated or an unknown process identity and refused an extra field and a zero allowance', () => {
	const parse = parsing(agentRegistrationSchema);
	const stated = parse('a stated provider, model and process', registration);
	const unidentified = parse('provider, model and process not known', unknownIdentity);
	const extra = parse('an extra field named hostname', { ...registration, hostname: 'build-02' });
	const zero = parse('an allowance of zero seconds', { ...registration, ttlSeconds: 0 });
	expect(stated.output).toEqual(registration);
	expect(unidentified.output).toEqual(unknownIdentity);
	expect(extra.error).toEqual([expect.stringContaining('hostname')]);
	expect(zero.error).toEqual([expect.stringContaining('ttlSeconds')]);
	recordExampleCases(
		{
			unitId: 'function.activity-types',
			symbol: 'agentRegistrationSchema',
			state: 'agent-registration-schema',
			evidence: 'examples-cases',
			file: 'agent-registration-schema.json'
		},
		[stated, unidentified, extra, zero]
	);
});

test('agentBeatSchema parsed a working and an idle heartbeat and refused an empty unit id and an extra field', () => {
	const parse = parsing(agentBeatSchema);
	const working = parse('working on a branch, a task, a loop and a unit', heartbeat);
	const idle = parse('idle, with nothing stated but the time', idleBeat);
	const blank = parse('a unit id that is empty', { ...heartbeat, units: [''] });
	const extra = parse('an extra field named pid', { ...heartbeat, pid: 48213 });
	expect(working.output).toEqual(heartbeat);
	expect(idle.output).toEqual(idleBeat);
	expect(blank.error).toEqual([expect.stringContaining('units.0')]);
	expect(extra.error).toEqual([expect.stringContaining('pid')]);
	recordExampleCases(
		{
			unitId: 'function.activity-types',
			symbol: 'agentBeatSchema',
			state: 'agent-beat-schema',
			evidence: 'examples-cases',
			file: 'agent-beat-schema.json'
		},
		[working, idle, blank, extra]
	);
});

test('agentEndSchema parsed a completed and a failed end and refused an unknown status and an extra field', () => {
	const parse = parsing(agentEndSchema);
	const completed = parse('completed with an outcome', completion);
	const failed = parse('failed with no outcome', failure);
	const cancelled = parse('a status other than completed or failed', {
		...completion,
		status: 'cancelled'
	});
	const extra = parse('an extra field named exitCode', { ...completion, exitCode: 0 });
	expect(completed.output).toEqual(completion);
	expect(failed.output).toEqual(failure);
	expect(cancelled.error).toEqual([expect.stringContaining('status')]);
	expect(extra.error).toEqual([expect.stringContaining('exitCode')]);
	recordExampleCases(
		{
			unitId: 'function.activity-types',
			symbol: 'agentEndSchema',
			state: 'agent-end-schema',
			evidence: 'examples-cases',
			file: 'agent-end-schema.json'
		},
		[completed, failed, cancelled, extra]
	);
});
