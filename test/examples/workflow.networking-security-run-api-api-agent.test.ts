import type { ApiClient } from './workflow.networking-security-run-api-api-agent.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { apiAgent, apiEventCursor, apiEvents } from '../../src/workflows/networking-security/run-api/apiAgent';

function client(input: Record<string, unknown>, data: unknown, options: Record<string, unknown> = {}) {
	const calls: unknown[][] = [];
	const value = {
		options: { input: JSON.stringify(input), ...options },
		call: async (...args: unknown[]) => {
			calls.push(args);
			return { data };
		}
	} as unknown as ApiClient;
	return { value, calls };
}

test('Defines a plan from contract input', async () => {
	const input = { category: 'security', title: 'Review API', goal: 'Document controls', contract: { responsibility: 'Review' } };
	const fake = client(input, { id: 'plan-7' });
	const result = await apiAgent(fake.value, 'define');
	expect(result).toEqual({ data: { id: 'plan-7' } });
	expect(fake.calls).toEqual([['createPlan', input]]);
	recordExampleCases({ unitId: 'workflow.networking-security-run-api-api-agent', symbol: 'apiAgent', state: 'defines-a-plan-from-contract-input', evidence: 'examples-cases', file: 'defines-a-plan-from-contract-input.json' }, [
		{ name: 'contract input is sent to createPlan', input, output: { result, call: fake.calls[0] } }
	]);
});

test('Calls the selected API method with request identity', async () => {
	const input = { runId: 'run-123', note: 'continue' };
	const fake = client(input, { accepted: true }, { requestId: '550e8400-e29b-41d4-a716-446655440000' });
	const result = await apiAgent(fake.value, 'call', 'events');
	expect(result).toEqual({ data: { accepted: true } });
	expect(fake.calls).toEqual([['events', input, '550e8400-e29b-41d4-a716-446655440000']]);
	recordExampleCases({ unitId: 'workflow.networking-security-run-api-api-agent', symbol: 'apiAgent', state: 'calls-the-selected-api-method-with-request-identity', evidence: 'examples-cases', file: 'calls-the-selected-api-method-with-request-identity.json' }, [
		{ name: 'selected method receives parsed input and configured request id', input, output: { result, call: fake.calls[0] } }
	]);
});

test('Starts an agent run with a retryable request id', async () => {
	const input = { provider: 'example-provider', model: 'model-v2', prompt: 'Summarize controls' };
	const requestId = '550e8400-e29b-41d4-a716-446655440000';
	const fake = client(input, { runId: 'run-123', status: 'queued' }, { requestId });
	const result = await apiAgent(fake.value, 'run');
	expect(result).toEqual({ runId: 'run-123', status: 'queued', requestId });
	expect(fake.calls).toEqual([['startRun', input, requestId]]);
	recordExampleCases({ unitId: 'workflow.networking-security-run-api-api-agent', symbol: 'apiAgent', state: 'starts-an-agent-run-with-a-retryable-request-id', evidence: 'examples-cases', file: 'starts-an-agent-run-with-a-retryable-request-id.json' }, [
		{ name: 'run response includes the configured retry identity', input: { ...input, requestId }, output: result }
	]);
});

test('Parses nonnegative safe event cursors', () => {
	const cursor = apiEventCursor('12');
	expect(cursor).toBe(12);
	recordExampleCases({ unitId: 'workflow.networking-security-run-api-api-agent', symbol: 'apiEventCursor', state: 'parses-nonnegative-safe-event-cursors', evidence: 'examples-cases', file: 'parses-nonnegative-safe-event-cursors.json' }, [
		{ name: 'decimal cursor text becomes a number', input: { text: '12' }, output: cursor }
	]);
});

test('Filters events and replay data to the requested run', async () => {
	const runId = 'run-123';
	const events = [
		{ value: { runId, type: 'started' } },
		{ value: { runId: 'run-other', type: 'started' } }
	];
	const data = { events, replay: { [runId]: { cursor: 4 }, 'run-other': { cursor: 9 } } };
	const fake = client({}, data, { after: '3' });
	const result = await apiEvents(fake.value, runId);
	expect(result).toEqual({ events: [events[0]], replay: { [runId]: { cursor: 4 } } });
	expect(fake.calls).toEqual([['events', { runId, after: 3 }]]);
	recordExampleCases({ unitId: 'workflow.networking-security-run-api-api-agent', symbol: 'apiEvents', state: 'filters-events-and-replay-data-to-the-requested-run', evidence: 'examples-cases', file: 'filters-events-and-replay-data-to-the-requested-run.json' }, [
		{ name: 'other runs are omitted from events and replay', input: { runId, after: '3', events }, output: result }
	]);
});

test('Throws ExpectedCliError for documented invalid inputs', async () => {
	const defineInput = { category: 'security', title: 'Review API', goal: 'Document controls' };
	const agentInput = { provider: 'example-provider', model: 'model-v2', prompt: 'Summarize controls' };
	const cases = [
		{ name: 'define without contract', input: defineInput, error: 'Define a plan with its category, title, goal and contract in --input.' },
		{ name: 'agent without model', input: { provider: 'example-provider' }, error: 'Agent input must name the exact provider and model.' },
		{ name: 'agent with invalid request id', input: { ...agentInput, requestId: 'retry-123' }, error: 'Agent request ids must be UUIDs.' },
		{ name: 'negative cursor', input: { text: '-1' }, error: 'Event cursors must be nonnegative integers.' },
		{ name: 'response without event list', input: { runId: 'run-123', events: null }, error: 'The API returned no run event list.' }
	];
	await expect(apiAgent(client(defineInput, {}).value, 'define')).rejects.toThrow('Define a plan');
	await expect(apiAgent(client({ provider: 'example-provider' }, {}).value, 'run')).rejects.toThrow('Agent input must name');
	await expect(apiAgent(client(agentInput, {}, { requestId: 'retry-123' }).value, 'run')).rejects.toThrow('Agent request ids must be UUIDs');
	expect(() => apiEventCursor('-1')).toThrow('Event cursors must be nonnegative integers');
	await expect(apiEvents(client({}, { events: null }).value, 'run-123')).rejects.toThrow('The API returned no run event list');
	recordExampleCases({ unitId: 'workflow.networking-security-run-api-api-agent', symbol: 'ExpectedCliError', state: 'throws-expectedclierror-for-documented-invalid-inputs', evidence: 'examples-cases', file: 'throws-expectedclierror-for-documented-invalid-inputs.json' }, cases);
});
