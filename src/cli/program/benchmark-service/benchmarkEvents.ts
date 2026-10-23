import type { RunnerEvent } from './benchmarkEvents.types';
export type { RunnerEvent } from './benchmarkEvents.types';
import type { BenchmarkTurn } from '../../../core/agents-providers/subagentBenchmarkTypes';
import { z } from 'zod';

const count = z.number().finite().nonnegative().optional();
const runnerEventSchema = z.object({
	type: z.string(),
	subtype: z.string().optional(),
	thread_id: z.string().min(1).optional(),
	session_id: z.string().min(1).optional(),
	model: z.string().min(1).optional(),
	is_error: z.boolean().optional(),
	total_cost_usd: count,
	usage: z
		.object({
			input_tokens: count,
			output_tokens: count,
			cached_input_tokens: count,
			cache_read_input_tokens: count
		})
		.optional()
});
export function benchmarkEvents(stdout: string): RunnerEvent[] {
	return stdout
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => runnerEventSchema.parse(JSON.parse(line)));
}
export function codexTurn(events: RunnerEvent[]): BenchmarkTurn {
	const session = events.find((event) => event.type === 'thread.started')?.thread_id;
	const completed = [...events].reverse().find((event) => event.type === 'turn.completed');
	if (!session || !completed || events.some((event) => event.type === 'turn.failed'))
		throw new Error('Codex did not complete a benchmark submission.');
	return {
		session,
		reportedModel: completed.model,
		usage: {
			inputTokens: completed.usage?.input_tokens,
			outputTokens: completed.usage?.output_tokens,
			cacheReadTokens: completed.usage?.cached_input_tokens
		}
	};
}
export function claudeTurn(events: RunnerEvent[]): BenchmarkTurn {
	const init = events.find((event) => event.type === 'system' && event.subtype === 'init');
	const result = [...events].reverse().find((event) => event.type === 'result');
	if (!result?.session_id || result.is_error || result.subtype !== 'success')
		throw new Error('Claude did not complete a benchmark submission.');
	return {
		session: result.session_id,
		reportedModel: init?.model,
		usage: {
			inputTokens: result.usage?.input_tokens,
			outputTokens: result.usage?.output_tokens,
			cacheReadTokens: result.usage?.cache_read_input_tokens,
			reportedCostUsd: result.total_cost_usd
		}
	};
}
