import type { Row } from './service.execution-runtimes-job-statistics.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { JobStatisticsService } from '../../src/services/execution-runtimes/JobStatisticsService';
import type { DurationEstimate, DurationSummary } from '../../src/services/execution-runtimes/JobStatisticsService.types';

function row(type: string, model: string, durationMs: number | undefined, outcome: Row['outcome']): Row {
	return { type, model, durationMs, outcome } as Row;
}

const contractRows: Row[] = [
	row('contract', 'model-a', 1000, 'pass'),
	row('contract', 'model-a', 2000, 'pass'),
	row('contract', 'model-a', 3000, 'fail'),
	row('contract', 'model-a', 4000, 'pass'),
	row('contract', 'model-a', 5000, 'pass'),
	row('contract', 'model-a', 9000, 'cancelled'),
	row('contract', 'model-a', undefined, 'pass')
];

const stubRow = row('stub', 'model-b', 700, 'pass');

test('Summarizes completed durations by type and model', () => {
	const service = new JobStatisticsService([...contractRows, stubRow]);
	const summary: DurationSummary[] = service.summary();
	const rounded = summary.map((item) => ({ ...item, meanMs: Math.round(item.meanMs) }));

	expect(rounded).toEqual([
		{ type: 'contract', model: 'model-a', count: 5, meanMs: 3000, medianMs: 3000, p80Ms: 4000, p90Ms: 5000 },
		{ type: 'stub', model: 'model-b', count: 1, meanMs: 700, medianMs: 700, p80Ms: 700, p90Ms: 700 }
	]);
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-job-statistics',
			symbol: 'summary',
			state: 'summarizes-completed-durations-by-type-and-model',
			evidence: 'examples-cases',
			file: 'summarizes-completed-durations-by-type-and-model.json'
		},
		[
			{
				name: 'pass and fail samples summarised, cancelled and unfinished excluded',
				input: { records: 'contract x7 (pass, fail, cancelled, unfinished), stub x1' },
				output: rounded
			}
		]
	);
});

test('Selects exact samples and conditions on elapsed running time', () => {
	const service = new JobStatisticsService([...contractRows, stubRow]);
	const exact: DurationEstimate | null = service.estimate('contract', 'model-a');
	const conditioned = service.estimate('contract', 'model-a', 2500);
	const tail = service.estimate('contract', 'model-a', 6000);
	const fallback = service.estimate('stub', 'model-c');

	expect(exact).toMatchObject({ fallback: 'exact', count: 5, conditionalCount: 5, medianMs: 3000, tailExtrapolated: false });
	expect(conditioned).toMatchObject({ fallback: 'exact', conditionalCount: 3, medianMs: 1500, meanMs: 1500, tailExtrapolated: false });
	expect(tail).toMatchObject({ conditionalCount: 0, tailExtrapolated: true, medianMs: 600, p80Ms: 2000, p90Ms: 5000 });
	expect(fallback).toMatchObject({ fallback: 'global', count: 6 });
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-job-statistics',
			symbol: 'estimate',
			state: 'selects-exact-samples-and-conditions-on-elapsed-running-time',
			evidence: 'examples-cases',
			file: 'selects-exact-samples-and-conditions-on-elapsed-running-time.json'
		},
		[
			{ name: 'exact distribution with no elapsed time', input: { type: 'contract', model: 'model-a', elapsedMs: 0 }, output: exact },
			{ name: 'residuals after 2500 ms elapsed', input: { type: 'contract', model: 'model-a', elapsedMs: 2500 }, output: conditioned },
			{ name: 'elapsed beyond every sample extrapolates the tail', input: { type: 'contract', model: 'model-a', elapsedMs: 6000 }, output: tail },
			{ name: 'unseen model with thin type history falls back to global', input: { type: 'stub', model: 'model-c', elapsedMs: 0 }, output: fallback }
		]
	);
});

test('Returns null when no usable completed samples remain', () => {
	const service = new JobStatisticsService([
		row('contract', 'model-a', -5, 'pass'),
		row('contract', 'model-a', 1000, 'cancelled')
	]);
	const estimate = service.estimate('contract', 'model-a');

	expect(estimate).toBeNull();
	expect(service.summary()).toEqual([]);
	recordExampleCases(
		{
			unitId: 'service.execution-runtimes-job-statistics',
			symbol: 'estimate',
			state: 'returns-null-when-no-usable-completed-samples-remain',
			evidence: 'examples-cases',
			file: 'returns-null-when-no-usable-completed-samples-remain.json'
		},
		[
			{
				name: 'negative duration and cancelled attempt leave no samples',
				input: { type: 'contract', model: 'model-a' },
				output: estimate
			}
		]
	);
});
