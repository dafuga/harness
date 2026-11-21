import { test } from 'vitest';
import { jevMetrics } from '../../src/cli/program/analyticsJevMetrics';
import type { AnalyticsEvent } from '../../src/core/reports-media/analyticsTypes';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { InvocationInput } from './workflow.analytics-jev-metrics.test.types';

function jevEvent(
	id: string,
	status: string,
	overrides: Partial<AnalyticsEvent> = {}
): AnalyticsEvent {
	return {
		id,
		timestamp: '2026-11-15T09:00:00Z',
		project: '/project',
		kind: 'jev',
		action: 'assessed',
		checkType: 'response',
		loop: 'review-loop',
		loopRun: 'run-17',
		step: 'analysis',
		task: `task-${id}`,
		agentModel: 'author-a',
		evaluatorModel: 'reviewer-a',
		status,
		fingerprint: id,
		report: `Assessment ${id}`,
		...overrides
	};
}

function summarize(result: ReturnType<typeof jevMetrics>) {
	return {
		checks: result.checks,
		outcomes: { ...result.outcomes },
		excluded: result.excluded,
		firstTry: { ...result.firstTry },
		tasks: result.tasks.map((task) => ({
			task: task.task,
			attempts: task.attempts,
			attemptsToPass: task.attemptsToPass,
			firstPassed: task.firstPassed
		}))
	};
}

const invocations: Array<{ name: string; input: InvocationInput }> = [
	{
		name: 'repeated task attempts and a separate clean task',
		input: {
			events: [
				jevEvent('attempt-1', 'violations', {
					task: 'task-auth',
					fingerprint: 'answer-1',
					report: 'Initial answer'
				}),
				jevEvent('attempt-2', 'satisfied', {
					task: 'task-auth',
					fingerprint: 'answer-2',
					report: 'Corrected answer'
				}),
				jevEvent('attempt-3', 'clean', {
					task: 'task-checkout',
					fingerprint: 'answer-3',
					report: 'Checkout answer'
				})
			],
			type: 'response'
		}
	},
	{
		name: 'duplicate, cached, and unassessed checks',
		input: {
			events: [
				jevEvent('replay-1', 'satisfied', {
					task: 'task-replay',
					fingerprint: 'same-check',
					report: 'Accepted response'
				}),
				jevEvent('replay-copy', 'violations', {
					task: 'task-replay',
					fingerprint: 'same-check'
				}),
				jevEvent('cached-1', 'clean', {
					task: 'task-cached',
					cached: true
				}),
				jevEvent('review-1', 'dry-run', { task: 'task-dry-run' })
			],
			type: 'response'
		}
	},
	{
		name: 'clean-code check filtered by author and evaluator model',
		input: {
			events: [
				jevEvent('clean-a', 'clean', {
					checkType: 'clean-code',
					agentModel: 'author-a',
					evaluatorModel: 'reviewer-b'
				}),
				jevEvent('clean-other-reviewer', 'clean', {
					checkType: 'clean-code',
					agentModel: 'author-a',
					evaluatorModel: 'reviewer-a'
				}),
				jevEvent('clean-other-author', 'clean', {
					checkType: 'clean-code',
					agentModel: 'author-b',
					evaluatorModel: 'reviewer-b'
				})
			],
			type: 'clean-code',
			author: 'author-a',
			model: 'reviewer-b'
		}
	}
];

const expectedSummaries = [
	{
		checks: 3,
		outcomes: { violations: 1, satisfied: 1, clean: 1 },
		excluded: 0,
		firstTry: { numerator: 1, denominator: 2, rate: 0.5 },
		tasks: [
			{
				task: 'task-auth',
				attempts: 2,
				attemptsToPass: 2,
				firstPassed: false
			},
			{
				task: 'task-checkout',
				attempts: 1,
				attemptsToPass: 1,
				firstPassed: true
			}
		]
	},
	{
		checks: 4,
		outcomes: { satisfied: 1, violations: 1, clean: 1, 'dry-run': 1 },
		excluded: 3,
		firstTry: { numerator: 1, denominator: 1, rate: 1 },
		tasks: [
			{
				task: 'task-replay',
				attempts: 1,
				attemptsToPass: 1,
				firstPassed: true
			}
		]
	},
	{
		checks: 1,
		outcomes: { clean: 1 },
		excluded: 0,
		firstTry: { numerator: 1, denominator: 1, rate: 1 },
		tasks: [
			{
				task: 'task-clean-a',
				attempts: 1,
				attemptsToPass: 1,
				firstPassed: true
			}
		]
	}
];

test('jevMetrics groups assessed checks by task and reports first-attempt outcomes', () => {
	const cases = invocations.map(({ name, input }) => ({
		name,
		input,
		output: summarize(jevMetrics(input.events, input.type, input.author, input.model))
	}));
	recordExampleCases(
		{
			unitId: 'workflow.analytics-jev-metrics',
			symbol: 'jevMetrics',
			state: 'first-attempt-metrics',
			evidence: 'examples-cases',
			file: 'first-attempt-metrics.json'
		},
		cases
	);
	expect(cases.map(({ output }) => output)).toEqual(expectedSummaries);
});
