import type { AnalyticsEvent } from '../core/analyticsTypes';
const assessed = new Set(['satisfied', 'clean', 'violations', 'needs-review']);
export function jevMetrics(
	events: AnalyticsEvent[],
	type: string,
	author?: string,
	model?: string
) {
	const checks = events.filter((event) => event.kind === 'jev' && event.checkType === type);
	const groups = new Map<string, AnalyticsEvent[]>();
	const seen = new Set<string>();
	let excluded = 0;
	for (const event of checks) {
		const identity = taskIdentity(event);
		const key = JSON.stringify([event.project, event.loopRun, identity, type]);
		const duplicate = event.fingerprint ? `${key}:${event.fingerprint}` : event.id;
		if (!eligible(event, identity) || seen.has(duplicate)) {
			if (firstModelMatches(event, author, model)) excluded++;
			continue;
		}
		seen.add(duplicate);
		const attempts = groups.get(key) ?? [];
		attempts.push(event);
		groups.set(key, attempts);
	}
	const tasks = [...groups.values()].filter((attempts) =>
		firstModelMatches(attempts[0], author, model)
	);
	const passed = (event: AnalyticsEvent) =>
		event.status === 'clean' || event.status === 'satisfied';
	const numerator = tasks.filter((attempts) => passed(attempts[0])).length;
	return {
		checks: checks.filter((event) => firstModelMatches(event, author, model)).length,
		outcomes: outcomeCounts(checks.filter((event) => firstModelMatches(event, author, model))),
		excluded,
		firstTry: {
			numerator,
			denominator: tasks.length,
			rate: tasks.length ? numerator / tasks.length : null
		},
		tasks: tasks.map((attempts) => ({
			project: attempts[0].project,
			loop: attempts[0].loop,
			step: attempts[0].step,
			task: attempts[0].task,
			agentModel: attempts[0].agentModel ?? 'unknown',
			attempts: attempts.length,
			attemptsToPass: attempts.findIndex(passed) < 0 ? null : attempts.findIndex(passed) + 1,
			firstPassed: passed(attempts[0]),
			report: attempts[0].report
		}))
	};
}
function outcomeCounts(events: AnalyticsEvent[]): Record<string, number> {
	const result: Record<string, number> = Object.create(null) as Record<string, number>;
	for (const event of events) {
		const status = event.status ?? 'unknown';
		result[status] = (result[status] ?? 0) + 1;
	}
	return result;
}

function taskIdentity(event: AnalyticsEvent): string | undefined {
	if (event.task) return event.task;
	return event.loop && event.step ? `${event.loop}/${event.step}` : undefined;
}
function eligible(event: AnalyticsEvent, identity: string | undefined): boolean {
	return Boolean(identity) && !event.cached && assessed.has(event.status ?? '');
}
function firstModelMatches(event: AnalyticsEvent, author?: string, model?: string): boolean {
	if (author !== undefined && (event.agentModel ?? 'unknown') !== author) return false;
	return !model || [event.agentModel, event.evaluatorModel].includes(model);
}
