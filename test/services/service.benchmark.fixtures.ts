import type { BenchmarkTrial } from '../../src/core/agents-providers/subagentBenchmarkTypes';

export const passedTrial: BenchmarkTrial = {
	id: 'trial-1',
	candidate: 'agent',
	repetition: 1,
	status: 'passed',
	firstSubmissionPassed: true,
	submissions: [],
	turns: [
		{
			session: 'session-1',
			usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 4, reportedCostUsd: 0.01 }
		}
	],
	agentDurationMs: 1100,
	evaluationDurationMs: 300,
	durationMs: 1400,
	repairs: 0
};
export const failedTrial: BenchmarkTrial = {
	id: 'trial-2',
	candidate: 'agent',
	repetition: 2,
	status: 'failed',
	firstSubmissionPassed: false,
	submissions: [],
	turns: [{ session: 'session-2', usage: { inputTokens: 12, outputTokens: 3 } }],
	agentDurationMs: 1300,
	evaluationDurationMs: 250,
	durationMs: 1550,
	repairs: 0
};
