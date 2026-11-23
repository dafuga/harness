import type { Run, Usage, Trial } from './workflow.benchmark-metrics.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { benchmarkMetrics } from '../../src/cli/program/benchmark-service/benchmarkMetrics';

const candidate = {
	id: 'codex-gpt-6-luna',
	runner: 'codex',
	model: 'gpt-6-luna',
	effort: 'high',
	instructions: '',
	tools: 'default'
} as Run['definition']['candidates'][number];

const passedUsage: Usage = {
	inputTokens: 400,
	outputTokens: 100,
	cacheReadTokens: 20,
	reportedCostUsd: 0.005
};

const failedUsage: Usage = {
	inputTokens: 300,
	outputTokens: 50,
	cacheReadTokens: 10,
	reportedCostUsd: 0.004
};

function trial(id: string, status: Trial['status'], usage: Usage, durationMs: number): Trial {
	return {
		id,
		candidate: candidate.id,
		repetition: 1,
		status,
		firstSubmissionPassed: status === 'passed',
		submissions: [],
		turns: [{ session: `session-${id}`, reportedModel: candidate.model, usage }],
		agentDurationMs: durationMs - 100,
		evaluationDurationMs: 100,
		durationMs,
		repairs: 0
	};
}

function makeRun(trials: Trial[]): Run {
	return {
		version: 1,
		id: 'run-001',
		project: '/workspace/project',
		revision: '0123456789abcdef0123456789abcdef01234567',
		fingerprint: 'abcdef0123456789abcdef0123456789abcdef01',
		seed: 'seed-1',
		definition: {
			version: 1,
			name: 'unit-benchmark',
			project: '.',
			revision: 'HEAD',
			task: 'Summarize a completed benchmark trial.',
			contract: 'Count passed trials and sum available usage.',
			allowedFiles: ['src/cli/program/benchmark-service/benchmarkMetrics.ts'],
			checks: [{ id: 'typecheck', command: 'bun run typecheck' }],
			setup: [],
			candidates: [candidate],
			budget: { repetitions: 1, timeoutMs: 900000, repairs: 0 }
		},
		runnerVersions: { codex: '1.0.0' },
		startedAt: '2026-11-15T09:00:00.000Z',
		trials
	};
}

test('Summarizes passed and failed trials', () => {
	const run = makeRun([
		trial('t1', 'passed', passedUsage, 1100),
		trial('t2', 'failed', failedUsage, 2000)
	]);
	const metrics = benchmarkMetrics(run)[0];

	expect(metrics.trials).toBe(2);
	expect(metrics.successRate).toBe(0.5);
	expect(metrics.firstSubmissionSuccessRate).toBe(0.5);
	expect(metrics.medianSuccessfulDurationMs).toBe(1100);
	expect(metrics.totalDurationMs).toBe(3100);
	expect(metrics.outcomes).toEqual({ passed: 1, failed: 1 });
	expect(metrics.usage).toEqual({ inputTokens: 700, outputTokens: 150, cacheReadTokens: 30 });
	expect(metrics.reportedCostUsd).toBeCloseTo(0.009);
	recordExampleCases(
		{
			unitId: 'workflow.benchmark-metrics',
			symbol: 'benchmarkMetrics',
			state: 'summarizes-passed-and-failed-trials',
			evidence: 'examples-cases',
			file: 'summarizes-passed-and-failed-trials.json'
		},
		[{ name: 'one passed and one failed trial', input: run, output: metrics }]
	);
});

test('Nulls usage and cost while a trial is running', () => {
	const run = makeRun([
		trial('t1', 'passed', passedUsage, 1100),
		trial('t2', 'running', passedUsage, 500)
	]);
	const metrics = benchmarkMetrics(run)[0];

	expect(metrics.successRate).toBe(0.5);
	expect(metrics.medianSuccessfulDurationMs).toBe(1100);
	expect(metrics.outcomes).toEqual({ passed: 1, running: 1 });
	expect(metrics.usage.inputTokens).toBeNull();
	expect(metrics.reportedCostUsd).toBeNull();
	recordExampleCases(
		{
			unitId: 'workflow.benchmark-metrics',
			symbol: 'benchmarkMetrics',
			state: 'nulls-usage-and-cost-while-a-trial-is-running',
			evidence: 'examples-cases',
			file: 'nulls-usage-and-cost-while-a-trial-is-running.json'
		},
		[{ name: 'passed trial beside a running trial', input: run, output: metrics }]
	);
});

test('Reports null rates for a candidate without trials', () => {
	const run = makeRun([]);
	const metrics = benchmarkMetrics(run)[0];

	expect(metrics.trials).toBe(0);
	expect(metrics.successRate).toBeNull();
	expect(metrics.firstSubmissionSuccessRate).toBeNull();
	expect(metrics.medianSuccessfulDurationMs).toBeNull();
	expect(metrics.usage.inputTokens).toBeNull();
	recordExampleCases(
		{
			unitId: 'workflow.benchmark-metrics',
			symbol: 'benchmarkMetrics',
			state: 'reports-null-rates-for-a-candidate-without-trials',
			evidence: 'examples-cases',
			file: 'reports-null-rates-for-a-candidate-without-trials.json'
		},
		[{ name: 'configured candidate with no trials recorded', input: run, output: metrics }]
	);
});
