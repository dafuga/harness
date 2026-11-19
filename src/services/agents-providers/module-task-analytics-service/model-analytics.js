// @harness-uid u_sak3l4rbdc
// Source of the v1 model-run interchange and standard-global price card.
// Harness vendors this module byte-for-byte. Keep platform data in the adapters.
export const RUN_SCHEMA_VERSION = 1;
export const RATE_CARD = 'standard-global-2026-11-19';
const claude = 'https://platform.claude.com/docs/en/about-claude/pricing';
const openai = 'https://developers.openai.com/api/docs/pricing';

// USD per million tokens: input, cached read, short write, long write, output.
/** @type {Partial<Record<string, {source: string, threshold: number, short: number[], long: number[]}>>} */
const rates = Object.assign(Object.create(null), {
	'claude-haiku-5-5': {
		source: claude,
		threshold: 100000,
		short: [0.1, 0.01, 0.125, 0.2, 0.5],
		long: [0.5, 0.05, 0.625, 1, 2.5]
	},
	'claude-sonnet-5-5': fixed(claude, [2, 0.1, 2.5, 4, 10]),
	'claude-opus-5-5': fixed(claude, [4, 0.2, 5, 8, 20]),
	'claude-fable-5-2': fixed(claude, [8, 0.2, 10, 16, 40]),
	'gpt-6-luna': standard([0.1, 0.01, 0.125, 0.25, 0.5]),
	'gpt-6.1-terra': standard([1, 0.05, 1.25, 2.5, 5]),
	'gpt-6.1-sol': standard([2, 0.1, 2.5, 5, 10]),
	'gpt-6.2-sol': standard([2, 0.1, 2.5, 5, 10]),
	'gpt-6-astra': standard([10, 1, 12.5, 25, 50]),
	'gpt-6.2-astra': standard([8, 0.4, 10, 20, 40])
});

/** @param {string} source @param {number[]} price */
function fixed(source, price) {
	return { source, threshold: Infinity, short: price, long: price };
}

/** @param {number[]} price */
function standard(price) {
	return {
		source: openai,
		threshold: 272000,
		short: price,
		long: price.map((rate, i) => rate * (i === 4 ? 1.5 : 2))
	};
}

/** @typedef {{inputTokens: number|null, outputTokens: number|null, cacheReadTokens: number|null, cacheWriteTokens: number|null, cacheWriteLongTokens?: number|null, reportedCostUsd?: number|null}} TokenUsage */
/** @typedef {{usd: number|null, minimumUsd: number|null, maximumUsd: number|null,
 * basis: 'cli-reported'|'standard-api-estimate'|'unavailable', rateCard: string, source: string|null, note: string}} ApiEquivalentCost */

/**
 * The model run's total input includes cache reads and writes. Aggregated usage
 * may span different prompt lengths, so compute bounds where tiers are unknown.
 * @param {string} model @param {TokenUsage} [usage]
 * @returns {ApiEquivalentCost}
 */
export function estimateApiCost(model, usage) {
	const rate = rates[model];
	const base = { rateCard: RATE_CARD, source: rate?.source ?? null };
	const reported = usage?.reportedCostUsd;
	if (reported != null && Number.isFinite(reported) && reported >= 0) {
		return {
			...base,
			usd: reported,
			minimumUsd: reported,
			maximumUsd: reported,
			basis: /** @type {const} */ ('cli-reported'),
			note: 'CLI-reported API-equivalent cost.'
		};
	}
	const unavailable = {
		...base,
		usd: null,
		minimumUsd: null,
		maximumUsd: null,
		basis: /** @type {const} */ ('unavailable')
	};
	if (!rate || usage?.inputTokens == null || usage.outputTokens == null) {
		return {
			...unavailable,
			note: rate ? 'Incomplete token usage.' : 'No verified price for this model.'
		};
	}
	const {
		inputTokens: input,
		outputTokens: output,
		cacheReadTokens: read,
		cacheWriteTokens: write,
		cacheWriteLongTokens: long
	} = usage;
	const counts = [input, output, read, write, long];
	if (
		counts.some((n) => n != null && (!Number.isSafeInteger(n) || n < 0)) ||
		(read ?? 0) + (write ?? 0) > input ||
		(long != null && (write == null || long > write))
	) {
		return { ...unavailable, note: 'Inconsistent token usage.' };
	}
	const high = input > rate.threshold ? rate.long : rate.short;
	const minimumUsd = tokenCost(usage, input, output, rate.short, false);
	const maximumUsd = tokenCost(usage, input, output, high, true);
	return {
		...base,
		usd: Math.abs(maximumUsd - minimumUsd) < 1e-12 ? minimumUsd : null,
		minimumUsd,
		maximumUsd,
		basis: /** @type {const} */ ('standard-api-estimate'),
		note: 'Standard global token rates. Ranges reflect unknown cache and request context tiers.'
	};
}

/** @param {TokenUsage} usage @param {number} input @param {number} output @param {number[]} price @param {boolean} upper */
function tokenCost(usage, input, output, [uncached, hit, short, long, out], upper) {
	const read = usage.cacheReadTokens;
	const write = usage.cacheWriteTokens;
	const writeRate = upper ? long : uncached;
	const reads = read ?? (upper ? 0 : input - (write ?? 0));
	const writes = write ?? (upper ? input - reads : 0);
	const longWrites = usage.cacheWriteLongTokens ?? (upper ? writes : 0);
	return (
		((input - reads - writes) * (write === null ? writeRate : uncached) +
			reads * hit +
			(writes - longWrites) * short +
			longWrites * long +
			output * out) /
		1e6
	);
}

/** @type {[string, RegExp][]} */
const KIND_RULES = [
	// Hard work starts at high effort.
	[
		'hard',
		/\[hard\]|\b(smart contracts?|concurrency|race conditions?|deadlocks?|tricky|hard bug|consensus|cryptograph\w*)\b/i
	],
	['ops', /\b(deploy|promot|release|production|prod\b|infra|migrat(e|ion) (the )?(db|database))/i],
	['refactor', /\b(refactor|rewrite|re-architect|architecture|redesign|overhaul|migrate)/i],
	['docs', /\b(readme|docs?\b|documentation|typo|wording|copy ?edit|changelog|comment)/i],
	['chore', /\b(bump|upgrade dep|dependenc|lint|format|rename|config|cleanup|clean up)/i],
	['bugfix', /\b(fix|bug|error|crash|broken|regression|fails?|failing|issue #?\d)/i],
	['test', /\b(tests?|coverage|e2e|playwright)\b/i],
	// Routine non-code: triage, status checks, research summaries, reports.
	[
		'triage',
		/\b(triage|status|check(s|ing)?|research|summar\w*|report|review|audit|investigate|inventory|list)\b/i
	]
];

/** @param {string} [title] @param {string} [notes] @param {string} [fallback] */
export function classifyTaskType(title, notes, fallback = 'feature') {
	for (const text of [title, notes]) {
		for (const [kind, pattern] of KIND_RULES) if (pattern.test(text ?? '')) return kind;
	}
	return fallback;
}

/** @typedef {'tracker'|'harness'} RunSource */
/** @typedef {'done'|'failed'|'rejected'|'timed_out'|'blocked'|'abandoned'|'pending_review'} RunOutcome */
/** @typedef {'small'|'medium'|'large'} Difficulty */
/** @typedef {{
 *   source: RunSource, id: string, taskId: string, chainId: string, taskType: string,
 *   project: string|null, provider: string, model: string, effort: string|null,
 *   startedAt?: string|null, finishedAt: string, outcome: RunOutcome, attempt: number|null,
 *   escalations?: number|null, estimatedDifficulty?: Difficulty|null, filesTouched?: number|null,
 *   danielCorrections?: number|null, rejectedBefore?: boolean|null, usage?: TokenUsage, cost?: ApiEquivalentCost,
 *   actualUsd?: number|null, codexCredits?: number|null
 * }} RunRecordInput */

/** @param {number|null} files @returns {Difficulty|null} */
export function difficultyForFiles(files) {
	return files === null ? null : files <= 2 ? 'small' : files <= 8 ? 'medium' : 'large';
}

/** @param {RunRecordInput} input */
export function createRunRecord(input) {
	const {
		source,
		id,
		taskId,
		chainId,
		taskType,
		project,
		provider,
		model,
		effort,
		finishedAt,
		outcome,
		attempt,
		startedAt = null,
		escalations = null,
		estimatedDifficulty = null,
		filesTouched = null,
		danielCorrections = null,
		rejectedBefore = null,
		usage,
		cost = estimateApiCost(model, usage),
		actualUsd = null,
		codexCredits = null
	} = input;
	return {
		schemaVersion: RUN_SCHEMA_VERSION,
		source,
		id,
		taskId,
		chainId,
		taskType,
		project,
		provider,
		model,
		effort,
		startedAt,
		finishedAt,
		wallTimeMs:
			startedAt === null ? null : Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
		outcome,
		attempt,
		retries: attempt === null ? null : attempt - 1,
		escalations,
		firstTry: outcome === 'done' && attempt === 1 && (danielCorrections ?? 0) === 0,
		estimatedDifficulty,
		measuredDifficulty: difficultyForFiles(filesTouched),
		filesTouched,
		danielCorrections,
		rejectedBefore,
		reworked: outcome === 'done' && rejectedBefore === true,
		inputTokens: usage?.inputTokens ?? null,
		outputTokens: usage?.outputTokens ?? null,
		cacheReadTokens: usage?.cacheReadTokens ?? null,
		cacheWriteTokens: usage?.cacheWriteTokens ?? null,
		apiEquivalentUsd: cost.usd,
		apiEquivalentMinUsd: cost.minimumUsd,
		apiEquivalentMaxUsd: cost.maximumUsd,
		apiEquivalentBasis: cost.basis,
		rateCard: cost.rateCard,
		actualUsd,
		codexCredits
	};
}

/** @typedef {ReturnType<typeof createRunRecord>} RunRecord */
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
		.map(([key, group]) => {
			const [taskType, model, effort, week] =
				/** @type {[string, string|null, string|null, string|null]} */ (JSON.parse(key));
			const successes = group.filter((run) =>
				firstTryOnly ? run.firstTry : run.outcome === 'done'
			);
			const successfulTasks = new Set(successes.map(taskKey)).size;
			const failures = firstTryOnly
				? group.length - successes.length
				: group.filter(isFailure).length;
			const priced = group.filter((run) => run.apiEquivalentMaxUsd !== null);
			const min = priced.reduce((sum, run) => sum + (run.apiEquivalentMinUsd ?? 0), 0);
			const max = priced.reduce((sum, run) => sum + (run.apiEquivalentMaxUsd ?? 0), 0);
			const complete = successfulTasks > 0 && priced.length === group.length;
			return {
				taskType,
				model,
				effort,
				week,
				runs: group.length,
				successes: successes.length,
				successfulTasks,
				failures,
				successRate:
					successes.length + failures ? successes.length / (successes.length + failures) : null,
				firstTry: successes.filter((run) => run.firstTry).length,
				retryRuns: group.filter((run) => (run.retries ?? 0) > 0).length,
				escalationRuns: group.filter((run) => run.escalations !== null && run.escalations > 0)
					.length,
				rejected: group.filter((run) => run.outcome === 'rejected').length,
				reworked: group.filter((run) => run.reworked).length,
				danielCorrections: group.reduce((sum, run) => sum + (run.danielCorrections ?? 0), 0),
				averageInputTokens: average(group, 'inputTokens'),
				averageOutputTokens: average(group, 'outputTokens'),
				averageWallTimeMs: average(group, 'wallTimeMs'),
				pricedRuns: priced.length,
				costPerSuccessfulTaskMinUsd: complete ? min / successfulTasks : null,
				costPerSuccessfulTaskMaxUsd: complete ? max / successfulTasks : null,
				actualUsd: knownTotal(group, 'actualUsd'),
				codexCredits: knownTotal(group, 'codexCredits')
			};
		});
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
