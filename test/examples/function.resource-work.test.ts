import { test } from 'vitest';
import type { ResourceRequest } from '../../src/core/execution-runtimes/resourceTypes';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { resourceWork } from '../../src/utils/execution-runtimes/resourceWork';

const SCOPED_REQUEST: Partial<ResourceRequest> = {
	priority: 'environment',
	cpus: 1,
	memoryMiB: 512,
	label: 'Scoped verification'
};
const UNKNOWN_KEY_REQUEST = { priority: 'coding' as const, label: 'Module task CLI', extra: true };
const OK_RESULT = { code: 0, stdout: 'done\n' };

/** Points the queue at a fixture home and clears any inherited lease. */
function queueEnv(home: string): Record<string, string | undefined> {
	return { HARNESS_RESOURCES_HOME: home, HARNESS_RESOURCE_LEASE: undefined };
}

test('Runs the action in an admitted slot and returns its result', async () => {
	await withTempDir('resource-work-success-', async (home) => {
		const env = queueEnv(home);
		const contextSummary: Record<string, unknown> = {};
		const output = await resourceWork(
			SCOPED_REQUEST,
			async (context) => {
				contextSummary.leaseIsJobId = context.env.HARNESS_RESOURCE_LEASE === context.id;
				contextSummary.cpus = context.env.HARNESS_RESOURCE_CPUS;
				contextSummary.memoryMiB = context.env.HARNESS_RESOURCE_MEMORY_MIB;
				contextSummary.priority = context.env.HARNESS_RESOURCE_PRIORITY;
				return OK_RESULT;
			},
			env
		);
		expect(output).toEqual(OK_RESULT);
		expect(contextSummary).toEqual({
			leaseIsJobId: true,
			cpus: '1',
			memoryMiB: '512',
			priority: 'environment'
		});
		recordExampleCases(
			{
				unitId: 'function.resource-work',
				symbol: 'resourceWork',
				state: 'runs-the-action-in-an-admitted-slot-and-returns-its-result',
				evidence: 'examples-cases',
				file: 'runs-the-action-in-an-admitted-slot-and-returns-its-result.json'
			},
			[
				{
					name: 'environment request with explicit cpus and memory',
					input: SCOPED_REQUEST,
					output: { result: OK_RESULT, context: contextSummary }
				}
			]
		);
	});
});

test('Re-raises an action failure after releasing its queue slot', async () => {
	await withTempDir('resource-work-failure-', async (home) => {
		const env = queueEnv(home);
		const failure = await resourceWork(
			SCOPED_REQUEST,
			async () => {
				throw new Error('fixture action failed');
			},
			env
		).catch((caught: unknown) => caught);
		const message = failure instanceof Error ? failure.message : String(failure);
		expect(message).toBe('fixture action failed');
		const followUp = await resourceWork(SCOPED_REQUEST, async () => OK_RESULT, env);
		expect(followUp).toEqual(OK_RESULT);
		recordExampleCases(
			{
				unitId: 'function.resource-work',
				symbol: 'resourceWork',
				state: 're-raises-an-action-failure-after-releasing-its-queue-slot',
				evidence: 'examples-cases',
				file: 'reraises-an-action-failure-after-releasing-its-queue-slot.json'
			},
			[
				{
					name: 'action rejects, then a later request is admitted',
					input: SCOPED_REQUEST,
					error: message
				},
				{
					name: 'follow-up request after the failed one',
					input: SCOPED_REQUEST,
					output: followUp
				}
			]
		);
	});
});

test('Rejects an unknown request key before the action is queued', async () => {
	await withTempDir('resource-work-validation-', async (home) => {
		let actionCalls = 0;
		const failure = await resourceWork(
			UNKNOWN_KEY_REQUEST,
			async () => {
				actionCalls += 1;
				return OK_RESULT;
			},
			queueEnv(home)
		).catch((caught: unknown) => caught);
		const message = failure instanceof Error ? failure.message : String(failure);
		expect(message).toMatch(/unrecognized key/i);
		expect(actionCalls).toBe(0);
		recordExampleCases(
			{
				unitId: 'function.resource-work',
				symbol: 'resourceWork',
				state: 'rejects-an-unknown-request-key-before-the-action-is-queued',
				evidence: 'examples-cases',
				file: 'rejects-an-unknown-request-key-before-the-action-is-queued.json'
			},
			[
				{
					name: 'request carries a key outside the strict schema',
					input: UNKNOWN_KEY_REQUEST,
					error: message
				}
			]
		);
	});
});
