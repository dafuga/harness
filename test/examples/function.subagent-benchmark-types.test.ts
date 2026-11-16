import { test } from 'vitest';
import type {
	BenchmarkTurn,
	BenchmarkUsage
} from '../../src/core/agents-providers/subagentBenchmarkTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Benchmark usage and turns retain optional provider details', () => {
	const minimalUsage = {} satisfies BenchmarkUsage;
	const reportedUsage = {
		inputTokens: 21,
		outputTokens: 8,
		cacheReadTokens: 5,
		reportedCostUsd: 0.003
	} satisfies BenchmarkUsage;
	const minimalTurn = {
		session: 'fixture-session-42',
		usage: minimalUsage
	} satisfies BenchmarkTurn;
	const reportedTurn = {
		session: 'fixture-session-43',
		reportedModel: 'fixture-model',
		usage: reportedUsage
	} satisfies BenchmarkTurn;

	expect([minimalTurn, reportedTurn]).toEqual([
		{ session: 'fixture-session-42', usage: {} },
		{
			session: 'fixture-session-43',
			reportedModel: 'fixture-model',
			usage: {
				inputTokens: 21,
				outputTokens: 8,
				cacheReadTokens: 5,
				reportedCostUsd: 0.003
			}
		}
	]);
	recordExampleCases(
		{
			unitId: 'function.subagent-benchmark-types',
			symbol: 'BenchmarkUsage',
			state: 'benchmark-usage-and-turns-retain-optional-provider-details',
			evidence: 'examples-cases',
			file: 'benchmark-usage-and-turns-retain-optional-provider-details.json'
		},
		[
			{
				name: 'provider reports no token or cost details',
				input: {},
				output: minimalTurn
			},
			{
				name: 'provider reports token counts, cost and model',
				input: reportedUsage,
				output: reportedTurn
			}
		]
	);
});
