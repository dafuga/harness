import type { TaskPublicEvent } from '../ModuleTaskRunnerAdapter.types';
import type { TaskUsage } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
const number = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
/** Codex input includes cached tokens; Claude input excludes cache reads and writes. */
export function taskUsage(provider: 'claude' | 'codex', events: TaskPublicEvent[]): TaskUsage {
	const result = [...events]
		.reverse()
		.find((e) => e.type === (provider === 'claude' ? 'result' : 'turn.completed')) ?? { type: '' };
	const usage = result.usage ?? {};
	const raw = number(usage.input_tokens),
		read = number(usage.cached_input_tokens ?? usage.cache_read_input_tokens);
	const write = number(usage.cache_creation_input_tokens ?? usage.cache_creation_tokens);
	const creation = usage.cache_creation as Record<string, unknown> | undefined;
	const long = number(creation?.ephemeral_1h_input_tokens ?? usage.cache_creation_12h_tokens);
	return {
		inputTokens: totalInput(provider, raw, read, write),
		outputTokens: number(usage.output_tokens),
		cacheReadTokens: read,
		cacheWriteTokens: write,
		cacheWriteLongTokens: long,
		reportedCostUsd: number(result.total_cost_usd),
		reasoningTokens: number(usage.reasoning_tokens)
	};
}
function totalInput(
	provider: string,
	raw: number | null,
	read: number | null,
	write: number | null
) {
	if (provider === 'codex') return raw;
	if ([raw, read, write].some((n) => n === null)) return null;
	return raw! + read! + write!;
}
