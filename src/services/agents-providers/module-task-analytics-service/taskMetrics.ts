import type { AnalyticsEvent } from '../../../core/reports-media/analyticsTypes';
export function taskMetrics(events: AnalyticsEvent[]) {
	const unique = [
		...new Map(
			events.filter((e) => e.kind === 'task' && e.moduleTask).map((e) => [e.id, e])
		).values()
	];
	const groups = new Map<string, AnalyticsEvent[]>();
	for (const event of unique) {
		const detail = event.moduleTask!;
		const key = JSON.stringify([
			detail.provider,
			detail.reportedModel ?? detail.model,
			detail.intelligence,
			Boolean(detail.reportedModel)
		]);
		groups.set(key, [...(groups.get(key) ?? []), event]);
	}
	return {
		...summary(unique),
		byModel: [...groups.values()]
			.map((group) => {
				const detail = group[0].moduleTask!;
				return {
					provider: detail.provider,
					model: detail.reportedModel ?? detail.model,
					intelligence: detail.intelligence,
					modelSource: detail.reportedModel ? 'reported' : 'requested',
					...summary(group)
				};
			})
			.sort(
				(a, b) => a.model.localeCompare(b.model) || a.intelligence.localeCompare(b.intelligence)
			)
	};
}
function summary(events: AnalyticsEvent[]) {
	const executions = events.filter((e) => e.action === 'executed');
	const submitted = events.filter((e) => e.action === 'submitted');
	const accepted = events.filter((e) => e.action === 'accepted').length;
	const bounces = events.filter((e) => e.action === 'incomplete').length;
	const reviewed = accepted + bounces;
	const usage = (key: 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens') =>
		total(executions.map((e) => e.moduleTask?.usage?.[key]));
	const costs = executions.map((e) => e.moduleTask?.apiCost);
	return {
		tasks: new Set(events.map((e) => JSON.stringify([e.project, e.task]))).size,
		executions: executions.length,
		submissions: submitted.length,
		accepted,
		bounces,
		reviewed,
		bounceRate: reviewed ? bounces / reviewed : null,
		executionFailures: executions.filter((e) => e.status === 'failed').length,
		inputTokens: usage('inputTokens'),
		outputTokens: usage('outputTokens'),
		cacheReadTokens: usage('cacheReadTokens'),
		cacheWriteTokens: usage('cacheWriteTokens'),
		apiCostUsd: total(costs.map((c) => c?.usd)),
		apiCostRangeUsd: {
			minimum: total(costs.map((c) => c?.minimumUsd)),
			maximum: total(costs.map((c) => c?.maximumUsd))
		},
		unpricedExecutions: costs.filter((c) => c?.minimumUsd == null || c?.maximumUsd == null).length,
		unreportedUsage: executions.filter(
			(e) => e.moduleTask?.usage?.inputTokens == null || e.moduleTask?.usage?.outputTokens == null
		).length
	};
}
function total(values: Array<number | null | undefined>): number | null {
	return !values.length || values.some((n) => n == null)
		? null
		: values.reduce<number>((sum, n) => sum + n!, 0);
}
