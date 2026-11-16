import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { benchmarkEvents, codexTurn, claudeTurn } from '../../src/cli/program/benchmark-service/benchmarkEvents';

test('Parses provider event streams in source order', () => {
	const stdout = '{"type":"thread.started","thread_id":"thread-01JQ4Y6D4YH5"}\n{"type":"turn.completed","model":"codex-model","usage":{"input_tokens":120,"output_tokens":24,"cached_input_tokens":8}}';
	const events = benchmarkEvents(stdout);
	const output = events.map(({ type, thread_id, model, usage }) => ({ type, thread_id, model, usage }));
	expect(output).toEqual([
		{ type: 'thread.started', thread_id: 'thread-01JQ4Y6D4YH5', model: undefined, usage: undefined },
		{
			type: 'turn.completed',
			thread_id: undefined,
			model: 'codex-model',
			usage: { input_tokens: 120, output_tokens: 24, cached_input_tokens: 8 }
		}
	]);
	recordExampleCases(
		{
			unitId: 'function.benchmark-events',
			symbol: 'benchmarkEvents',
			state: 'parses-provider-event-streams-in-source-order',
			evidence: 'examples-cases',
			file: 'parses-provider-event-streams-in-source-order.json'
		},
		[{ name: 'Codex stream with session and usage', input: stdout, output }]
	);
});

test('Extracts a completed Codex turn', () => {
	const events = [
		{ type: 'thread.started', thread_id: 'thread-01JQ4Y6D4YH5' },
		{ type: 'turn.completed', model: 'codex-model', usage: { input_tokens: 120, output_tokens: 24, cached_input_tokens: 8 } }
	];
	const turn = codexTurn(events);
	expect(turn).toEqual({
		session: 'thread-01JQ4Y6D4YH5',
		reportedModel: 'codex-model',
		usage: { inputTokens: 120, outputTokens: 24, cacheReadTokens: 8 }
	});
	recordExampleCases(
		{
			unitId: 'function.benchmark-events',
			symbol: 'codexTurn',
			state: 'extracts-a-completed-codex-turn',
			evidence: 'examples-cases',
			file: 'extracts-a-completed-codex-turn.json'
		},
		[{ name: 'completed Codex submission', input: events, output: turn }]
	);
});

test('Extracts a successful Claude turn with usage and cost', () => {
	const events = [
		{ type: 'system', subtype: 'init', model: 'claude-model' },
		{
			type: 'result', subtype: 'success', session_id: 'session-01JQ4Y6D4YH5', is_error: false,
			total_cost_usd: 0.004,
			usage: { input_tokens: 140, output_tokens: 30, cache_read_input_tokens: 12 }
		}
	];
	const turn = claudeTurn(events);
	expect(turn).toEqual({
		session: 'session-01JQ4Y6D4YH5',
		reportedModel: 'claude-model',
		usage: { inputTokens: 140, outputTokens: 30, cacheReadTokens: 12, reportedCostUsd: 0.004 }
	});
	recordExampleCases(
		{
			unitId: 'function.benchmark-events',
			symbol: 'claudeTurn',
			state: 'extracts-a-successful-claude-turn-with-usage-and-cost',
			evidence: 'examples-cases',
			file: 'extracts-a-successful-claude-turn-with-usage-and-cost.json'
		},
		[{ name: 'successful Claude submission', input: events, output: turn }]
	);
});
