import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { CodexResponsesSerializer } from '../../src/serializers/agents-providers/CodexResponsesSerializer';

test('Announces response creation and progress', () => {
	const model = 'gpt-5-codex';
	const events = new CodexResponsesSerializer(model).start();
	expect(events.map((event) => event.type)).toEqual(['response.created', 'response.in_progress']);
	recordExampleCases(
		{
			unitId: 'serializer.codex-responses',
			symbol: 'start',
			state: 'announces-response-creation-and-progress',
			evidence: 'examples-cases',
			file: 'announces-response-creation-and-progress.json'
		},
		[
			{
				name: 'starts an in-progress response for the selected model',
				input: { model },
				output: events.map(({ type, sequence_number, response }) => ({
					type,
					sequence_number,
					model: (response as Record<string, unknown>).model,
					status: (response as Record<string, unknown>).status
				}))
			}
		]
	);
});

test('Streams text and completes the assistant message', () => {
	const serializer = new CodexResponsesSerializer('gpt-5-codex');
	const first = serializer.text('Hello, ');
	const second = serializer.text('world!');
	const finished = serializer.finish();
	expect(finished[0].type).toBe('response.output_text.done');
	recordExampleCases(
		{
			unitId: 'serializer.codex-responses',
			symbol: 'text',
			state: 'streams-text-and-completes-the-assistant-message',
			evidence: 'examples-cases',
			file: 'streams-text-and-completes-the-assistant-message.json'
		},
		[
			{
				name: 'appends fragments to one assistant message',
				input: { model: 'gpt-5-codex', deltas: ['Hello, ', 'world!'] },
				output: {
					firstEvents: first.map((event) => event.type),
					secondEvents: second.map((event) => event.type),
					completion: finished.map((event) => ({
						type: event.type,
						text: event.text,
						status: (event.response as Record<string, unknown> | undefined)?.status
					}))
				}
			}
		]
	);
});

test('Serializes function and custom tool calls', () => {
	const ordinary = {
		id: 'call_550e8400-e29b-41d4-a716-446655440000',
		name: 'get_weather',
		arguments: '{"city":"Toronto"}',
		custom: false
	};
	const custom = {
		id: 'call_123e4567-e89b-42d3-a456-426614174000',
		name: 'search_docs',
		arguments: '{"input":{"query":"release notes"}}',
		namespace: 'docs',
		custom: true
	};
	const normalEvents = new CodexResponsesSerializer('codex-model').call(ordinary);
	const customEvents = new CodexResponsesSerializer('codex-model').call(custom);
	expect((customEvents[0].item as Record<string, unknown>).type).toBe('custom_tool_call');
	recordExampleCases(
		{
			unitId: 'serializer.codex-responses',
			symbol: 'call',
			state: 'serializes-function-and-custom-tool-calls',
			evidence: 'examples-cases',
			file: 'serializes-function-and-custom-tool-calls.json'
		},
		[
			{
				name: 'serializes a function call',
				input: ordinary,
				output: normalEvents.map(({ type, item }) => ({ type, item }))
			},
			{
				name: 'serializes a namespaced custom tool call',
				input: custom,
				output: customEvents.map(({ type, item }) => ({ type, item }))
			}
		]
	);
});

test('Completes a response without text', () => {
	const model = 'codex-model';
	const events = new CodexResponsesSerializer(model).finish();
	expect(events).toHaveLength(1);
	recordExampleCases(
		{
			unitId: 'serializer.codex-responses',
			symbol: 'finish',
			state: 'completes-a-response-without-text',
			evidence: 'examples-cases',
			file: 'completes-a-response-without-text.json'
		},
		[
			{
				name: 'finishes an empty response',
				input: { model },
				output: events.map(({ type, sequence_number, response }) => ({
					type,
					sequence_number,
					model: (response as Record<string, unknown>).model,
					status: (response as Record<string, unknown>).status,
					output: (response as Record<string, unknown>).output
				}))
			}
		]
	);
});

test('Reports a gateway failure', () => {
	const model = 'gpt-5-codex';
	const message = 'Upstream gateway timed out';
	const events = new CodexResponsesSerializer(model).fail(message);
	expect((events[0].response as Record<string, unknown>).status).toBe('failed');
	recordExampleCases(
		{
			unitId: 'serializer.codex-responses',
			symbol: 'fail',
			state: 'reports-a-gateway-failure',
			evidence: 'examples-cases',
			file: 'reports-a-gateway-failure.json'
		},
		[
			{
				name: 'preserves the gateway error message',
				input: { model, message },
				output: events.map(({ type, response }) => ({
					type,
					status: (response as Record<string, unknown>).status,
					error: (response as Record<string, unknown>).error
				}))
			}
		]
	);
});
