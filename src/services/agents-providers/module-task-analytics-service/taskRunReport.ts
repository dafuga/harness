// @harness-uid u_pjgqyna5c4
import type { RunRecord } from './modelRunRecord.types';

const minimumFirstRuns = 5;
const minimumFirstTryRate = 0.8;

export function taskRunReport(runRecords: RunRecord[]) {
	return {
		runRecords,
		runsByModel: modelRuns(runRecords),
		byModelTaskDifficulty: groupedRuns(runRecords, true),
		recommendations: recommendModels(runRecords)
	};
}

/** Failures caused by the machine or provider account, not by the model's work. */
const infraCauses = new Set([
	'quota',
	'provider-error',
	'workspace-error',
	'cancelled',
	'abandoned'
]);

function infraFailure(run: RunRecord): boolean {
	return run.outcome !== 'done' && infraCauses.has(run.rejectionCause ?? '');
}

function modelRuns(runRecords: RunRecord[]) {
	const groups = new Map<string, RunRecord[]>();
	for (const run of runRecords) {
		const key = JSON.stringify([run.provider, run.model, run.effort]);
		groups.set(key, [...(groups.get(key) ?? []), run]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, group]) => ({
			provider: group[0].provider,
			model: group[0].model,
			effort: group[0].effort,
			...summarize(group)
		}));
}

function groupedRuns(runRecords: RunRecord[], byMeasuredDifficulty: boolean) {
	const groups = new Map<string, RunRecord[]>();
	for (const run of runRecords) {
		const key = JSON.stringify([
			run.taskType,
			run.provider,
			run.model,
			run.effort,
			run.estimatedDifficulty,
			byMeasuredDifficulty ? run.measuredDifficulty : null
		]);
		const group = groups.get(key);
		if (group) group.push(run);
		else groups.set(key, [run]);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, group]) => ({
			taskType: group[0].taskType,
			provider: group[0].provider,
			model: group[0].model,
			effort: group[0].effort,
			estimatedDifficulty: group[0].estimatedDifficulty,
			measuredDifficulty: byMeasuredDifficulty ? group[0].measuredDifficulty : null,
			...summarize(group)
		}));
}

function summarize(group: RunRecord[]) {
	const settled = group.filter((run) => run.outcome !== 'pending_review');
	const accepted = settled.filter((run) => run.outcome === 'done');
	const firstTry = accepted.filter((run) => run.firstTry).length;
	const firstRuns = settled.filter((run) => run.attempt === 1).length;
	const infra = settled.filter(infraFailure);
	const ranFirst = settled.filter((run) => run.attempt === 1 && !infraFailure(run)).length;
	const allCost = costs(group);
	const settledCost = costs(settled);
	return {
		runs: group.length,
		accepted: accepted.length,
		firstTry,
		firstTryRate: firstRuns ? firstTry / firstRuns : null,
		firstTryRateWhenRan: ranFirst ? firstTry / ranFirst : null,
		acceptanceRate: settled.length ? accepted.length / settled.length : null,
		infraFailures: infra.length,
		infraFailureRate: settled.length ? infra.length / settled.length : null,
		infraFailuresByCause: frequencies(infra.map((run) => run.rejectionCause!)),
		retryRuns: group.filter((run) => (run.retries ?? 0) > 0).length,
		reworked: accepted.filter((run) => run.reworked).length,
		outcomes: frequencies(group.map((run) => run.outcome)),
		rejectionsByCause: frequencies(
			settled.filter((run) => run.outcome !== 'done').map((run) => run.rejectionCause ?? 'unknown')
		),
		averageInputTokens: average(group.map((run) => run.inputTokens)),
		averageOutputTokens: average(group.map((run) => run.outputTokens)),
		averageWallTimeMs: average(group.map((run) => run.wallTimeMs)),
		apiEquivalentUsd: allCost,
		costPerAcceptanceUsd:
			accepted.length && settledCost
				? {
						minimum: settledCost.minimum / accepted.length,
						maximum: settledCost.maximum / accepted.length
					}
				: null
	};
}

function frequencies(values: string[]): Record<string, number> {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return Object.fromEntries(counts);
}

function average(values: (number | null)[]): number | null {
	const known = values.filter((value) => value !== null);
	return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}

function costs(group: RunRecord[]) {
	if (
		!group.length ||
		group.some((run) => run.apiEquivalentMinUsd === null || run.apiEquivalentMaxUsd === null)
	)
		return null;
	return {
		minimum: group.reduce((sum, run) => sum + run.apiEquivalentMinUsd!, 0),
		maximum: group.reduce((sum, run) => sum + run.apiEquivalentMaxUsd!, 0)
	};
}

function recommendModels(runRecords: RunRecord[]) {
	const firstRuns = runRecords.filter(
		(run) => run.attempt === 1 && run.outcome !== 'pending_review'
	);
	const ranked = groupedRuns(firstRuns, false)
		.filter(
			(row) =>
				row.runs >= minimumFirstRuns &&
				(row.firstTryRate ?? 0) >= minimumFirstTryRate &&
				row.costPerAcceptanceUsd
		)
		.sort(
			(a, b) =>
				a.costPerAcceptanceUsd!.maximum - b.costPerAcceptanceUsd!.maximum ||
				b.firstTryRate! - a.firstTryRate! ||
				b.runs - a.runs
		);
	const choices = new Map<string, (typeof ranked)[number]>();
	for (const row of ranked) {
		const key = JSON.stringify([row.taskType, row.estimatedDifficulty]);
		if (!choices.has(key)) choices.set(key, row);
	}
	return [...choices.values()];
}
