// @harness-uid u_sak3l4rbdc
// Shared analytics, schema and rate card entry point. Harness vendors these modules byte-for-byte.
export { estimateApiCost, RATE_CARD } from './model-pricing.js';
export {
	classifyTaskType,
	createRunRecord,
	difficultyForFiles,
	RUN_SCHEMA_VERSION
} from './model-run-record.js';

/** @typedef {import('./model-run-record.js').RunRecord} RunRecord */
/** @typedef {{
 * taskType: string, model: string|null, effort: string|null, week: string|null, runs: number,
 * successes: number, successfulTasks: number, failures: number, successRate: number|null,
 * firstTry: number, retryRuns: number, escalationRuns: number, rejected: number, reworked: number,
 * danielCorrections: number, averageInputTokens: number|null, averageOutputTokens: number|null,
 * averageWallTimeMs: number|null, pricedRuns: number, costPerSuccessfulTaskMinUsd: number|null,
 * costPerSuccessfulTaskMaxUsd: number|null, actualUsd: {total: number|null, knownRuns: number},
 * codexCredits: {total: number|null, knownRuns: number}
 * }} ModelRunSummaryRow */
/** @typedef {{rows: ModelRunSummaryRow[], trend: ModelRunSummaryRow[], byTaskType: ModelRunSummaryRow[], recommendations: ModelRunSummaryRow[]}} ModelRunSummary */
/** @param {RunRecord[]} records @returns {ModelRunSummary} */
export function summarizeModelRuns(records) {
	const unique = [...new Map(records.map((run) => [run.id, run])).values()];
	return {
		rows: groupRuns(unique),
		trend: groupRuns(unique, { weekly: true }),
		byTaskType: groupRuns(unique, { byTaskType: true }),
		recommendations: recommendModels(unique)
	};
}

/** @param {RunRecord[]} runs @param {{weekly?: boolean, byTaskType?: boolean, firstTryOnly?: boolean}} [options]
 * @returns {ModelRunSummaryRow[]} */
function groupRuns(runs, { weekly = false, byTaskType = false, firstTryOnly = false } = {}) {
	/** @type {Map<string, RunRecord[]>} */
	const groups = new Map();
	for (const run of runs) {
		const key = JSON.stringify([
			run.taskType,
			byTaskType ? null : run.model,
			byTaskType ? null : run.effort,
			weekly ? weekOf(run.finishedAt) : null
		]);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)?.push(run);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, group]) => summarizeGroup(key, group, firstTryOnly));
}

/** @param {string} key @param {RunRecord[]} group @param {boolean} firstTryOnly */
function summarizeGroup(key, group, firstTryOnly) {
	const [taskType, model, effort, week] =
		/** @type {[string, string|null, string|null, string|null]} */ (JSON.parse(key));
	const successes = group.filter((run) => (firstTryOnly ? run.firstTry : run.outcome === 'done'));
	const successfulTasks = new Set(successes.map(taskKey)).size;
	const failures = firstTryOnly ? group.length - successes.length : group.filter(isFailure).length;
	const decided = successes.length + failures;
	return {
		taskType,
		model,
		effort,
		week,
		runs: group.length,
		successes: successes.length,
		successfulTasks,
		failures,
		successRate: decided ? successes.length / decided : null,
		firstTry: successes.filter((run) => run.firstTry).length,
		retryRuns: group.filter((run) => (run.retries ?? 0) > 0).length,
		escalationRuns: group.filter((run) => (run.escalations ?? 0) > 0).length,
		rejected: group.filter((run) => run.outcome === 'rejected').length,
		reworked: group.filter((run) => run.reworked).length,
		danielCorrections: group.reduce((sum, run) => sum + (run.danielCorrections ?? 0), 0),
		averageInputTokens: average(group, 'inputTokens'),
		averageOutputTokens: average(group, 'outputTokens'),
		averageWallTimeMs: average(group, 'wallTimeMs'),
		...groupCost(group, successfulTasks),
		actualUsd: knownTotal(group, 'actualUsd'),
		codexCredits: knownTotal(group, 'codexCredits')
	};
}

/** @param {RunRecord[]} group @param {number} successfulTasks */
function groupCost(group, successfulTasks) {
	const priced = group.filter((run) => run.apiEquivalentMaxUsd !== null);
	const complete = successfulTasks > 0 && priced.length === group.length;
	return {
		pricedRuns: priced.length,
		costPerSuccessfulTaskMinUsd: complete
			? priced.reduce((sum, run) => sum + (run.apiEquivalentMinUsd ?? 0), 0) / successfulTasks
			: null,
		costPerSuccessfulTaskMaxUsd: complete
			? priced.reduce((sum, run) => sum + (run.apiEquivalentMaxUsd ?? 0), 0) / successfulTasks
			: null
	};
}

/** @param {RunRecord} run */
const taskKey = (run) => JSON.stringify([run.source, run.project, run.taskId, run.chainId]);
/** @param {RunRecord} run */
const isFailure = (run) => ['failed', 'rejected', 'timed_out'].includes(run.outcome);

/** @param {string} time */
function weekOf(time) {
	const date = new Date(time);
	date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
	return date.toISOString().slice(0, 10);
}

/** @param {RunRecord[]} group @param {'inputTokens'|'outputTokens'|'wallTimeMs'} field */
function average(group, field) {
	const values = group.map((run) => run[field]).filter((n) => n !== null);
	return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
}

/** @param {RunRecord[]} group @param {'actualUsd'|'codexCredits'} field */
function knownTotal(group, field) {
	const values = group.map((run) => run[field]).filter((n) => n !== null);
	return {
		total: values.length ? values.reduce((sum, n) => sum + n, 0) : null,
		knownRuns: values.length
	};
}

/**
 * Rank independently observed first attempts. Retried successes do not count
 * as first-try success for either model. The conservative upper cost is used.
 * @param {RunRecord[]} records @param {{minSamples?: number, reliability?: number, allCandidates?: boolean}} [options]
 * @returns {ModelRunSummaryRow[]}
 */
export function recommendModels(
	records,
	{ minSamples = 5, reliability = 0.8, allCandidates = false } = {}
) {
	const initial = new Map(
		records
			.filter((r) => r.attempt === 1 && (r.outcome === 'done' || isFailure(r)))
			.map((r) => [taskKey(r), r])
	);
	const ranked = groupRuns([...initial.values()], { firstTryOnly: true })
		.filter(
			(row) =>
				row.runs >= minSamples &&
				(row.successRate ?? 0) >= reliability &&
				row.costPerSuccessfulTaskMaxUsd !== null
		)
		.sort(
			(a, b) =>
				(a.costPerSuccessfulTaskMaxUsd ?? Infinity) - (b.costPerSuccessfulTaskMaxUsd ?? Infinity) ||
				(b.successRate ?? 0) - (a.successRate ?? 0) ||
				b.runs - a.runs
		);
	if (allCandidates) return ranked;
	const firstByType = new Map();
	for (const row of ranked) if (!firstByType.has(row.taskType)) firstByType.set(row.taskType, row);
	return ranked.filter((row) => firstByType.get(row.taskType) === row);
}
