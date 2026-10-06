import type { AnalyticsEvent, AnalyticsFilter, LoopMetric } from '../core/analyticsTypes';
import { jevMetrics } from './analyticsJevMetrics';

export function analyticsSnapshot(events: AnalyticsEvent[], filter: AnalyticsFilter = {}) {
	const selected = events.filter((event) => matches(event, filter));
	const loops = loopMetrics(selected);
	const assessmentScope = events.filter((event) => matches(event, { ...filter, model: undefined }));
	return {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		filters: filter,
		summary: {
			events: selected.length,
			projects: new Set(selected.map((event) => event.project)).size,
			commands: counts(
				selected.filter((event) => event.kind === 'command'),
				(event) => event.action
			),
			loops: loops.length,
			completedLoops: loops.filter((loop) => loop.status === 'complete').length,
			evaluatorOutcomes: counts(
				selected.filter((event) => event.kind === 'evaluation'),
				(event) => event.status ?? 'unknown'
			),
			templates: counts(loops, (loop) => loop.template ?? 'custom'),
			daily: counts(selected, (event) => event.timestamp.slice(0, 10))
		},
		loops,
		jev: {
			response: jevMetrics(assessmentScope, 'response', undefined, filter.model),
			cleanCode: jevMetrics(assessmentScope, 'clean-code', undefined, filter.model)
		},
		models: modelMetrics(assessmentScope, filter.model),
		events: selected
	};
}
function matches(event: AnalyticsEvent, filter: AnalyticsFilter): boolean {
	const identities = ['project', 'loop', 'task'] as const;
	if (!identities.every((key) => !filter[key] || event[key] === filter[key])) return false;
	if (filter.model && ![event.agentModel, event.evaluatorModel].includes(filter.model))
		return false;
	return (
		(!filter.since || event.timestamp >= filter.since) &&
		(!filter.until || event.timestamp <= filter.until)
	);
}

export function counts<T>(items: T[], key: (item: T) => string): Record<string, number> {
	const result: Record<string, number> = Object.create(null) as Record<string, number>;
	for (const item of items) {
		const name = key(item);
		result[name] = (result[name] ?? 0) + 1;
	}
	return result;
}
function loopMetrics(events: AnalyticsEvent[]): LoopMetric[] {
	return events
		.filter((event) => event.kind === 'loop' && event.action === 'created')
		.map((event) => {
			const related = events.filter(
				(item) =>
					item.project === event.project &&
					item.loop === event.loop &&
					item.loopRun === event.loopRun
			);
			const completed = related.find((item) => item.kind === 'loop' && item.action === 'completed');
			return {
				project: event.project,
				name: event.loop ?? '',
				template: event.template,
				agentModel: event.agentModel ?? 'unknown',
				status: completed ? 'complete' : 'active',
				createdAt: event.timestamp,
				completedAt: completed?.timestamp,
				durationMs: completed
					? Date.parse(completed.timestamp) - Date.parse(event.timestamp)
					: undefined,
				evaluations: related.filter((item) => item.kind === 'evaluation').length
			};
		});
}
function modelMetrics(events: AnalyticsEvent[], model?: string) {
	const checks = events.filter((event) => event.kind === 'jev' && matches(event, { model }));
	return {
		authors: counts(checks, (event) => event.agentModel ?? 'unknown'),
		loopAuthors: counts(loopMetrics(events), (loop) => loop.agentModel),
		evaluators: counts(checks, (event) => event.evaluatorModel ?? 'unknown'),
		inputTokens: checks.reduce((total, event) => total + (event.inputTokens ?? 0), 0),
		outputTokens: checks.reduce((total, event) => total + (event.outputTokens ?? 0), 0),
		firstTryByAuthor: Object.fromEntries(
			[...new Set(checks.map((event) => event.agentModel ?? 'unknown'))].map((model) => [
				model,
				{
					response: jevMetrics(events, 'response', model),
					cleanCode: jevMetrics(events, 'clean-code', model)
				}
			])
		)
	};
}
