import { AnalyticsRepository } from '../../../../src/repositories/AnalyticsRepository';
import type { AnalyticsEvent } from '../../../../src/core/analyticsTypes';
export function seedAnalyticsE2e(): void {
	if (!process.env.HARNESS_ANALYTICS_HOME?.startsWith('/tmp/'))
		throw new Error('Fixture requires a temporary analytics store.');
	const repo = new AnalyticsRepository();
	const events = fixtureEvents();
	for (const event of events) repo.record(event);
	repo.close();
}
const common = {
	project: '/fixture/alpha',
	loop: 'delivery',
	loopRun: 'run-1',
	agentModel: 'fixture-author',
	timestamp: '2026-10-01T10:00:00Z'
};
const events: AnalyticsEvent[] = [
	{ ...common, id: 'loop', kind: 'loop', action: 'created', template: 'feature' },
	{ ...common, id: 'done', kind: 'loop', action: 'completed', timestamp: '2026-10-01T11:00:00Z' },
	{ ...common, id: 'command', kind: 'command', action: 'audit' },
	{
		...common,
		id: 'r1',
		kind: 'jev',
		action: 'checked',
		checkType: 'response',
		task: 'task-one',
		status: 'satisfied',
		evaluatorModel: 'fixture-evaluator',
		inputTokens: 100,
		outputTokens: 20,
		report: 'fixture-report'
	},
	{
		...common,
		id: 'r2',
		kind: 'jev',
		action: 'checked',
		checkType: 'response',
		task: 'task-two',
		status: 'violations'
	},
	{
		...common,
		id: 'r3',
		kind: 'jev',
		action: 'checked',
		checkType: 'response',
		task: 'task-two',
		status: 'satisfied',
		timestamp: '2026-10-01T10:01:00Z'
	},
	{
		...common,
		id: 'c1',
		kind: 'jev',
		action: 'checked',
		checkType: 'clean-code',
		task: 'code-one',
		status: 'clean'
	},
	{
		...common,
		id: 'cached',
		kind: 'jev',
		action: 'checked',
		checkType: 'clean-code',
		task: 'cached-one',
		cached: true,
		status: 'clean'
	}
];

function fixtureEvents(): AnalyticsEvent[] {
	return events;
}
seedAnalyticsE2e();
