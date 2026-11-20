// @harness-uid u_jqwsplz2qq
import type { TaskUsage } from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export function sumSessionUsage(observations: (TaskUsage | undefined)[]): TaskUsage | undefined {
	if (!observations.some(Boolean)) return;
	const sum = (key: keyof TaskUsage) => {
		const values = observations.map((usage) => usage?.[key] ?? null);
		return values.some((n) => n === null)
			? null
			: values.reduce<number>((total, n) => total + n!, 0);
	};
	return {
		inputTokens: sum('inputTokens'),
		outputTokens: sum('outputTokens'),
		cacheReadTokens: sum('cacheReadTokens'),
		cacheWriteTokens: sum('cacheWriteTokens'),
		cacheWriteLongTokens: sum('cacheWriteLongTokens'),
		reportedCostUsd: sum('reportedCostUsd'),
		reasoningTokens: sum('reasoningTokens')
	};
}
