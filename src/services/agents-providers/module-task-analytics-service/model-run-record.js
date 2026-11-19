// @harness-uid u_sak3l4rbdc
// Shared data schema for Tracker and Harness run records.
import { estimateApiCost } from './model-pricing.js';

export const RUN_SCHEMA_VERSION = 1;
/** @typedef {import('./model-pricing.js').TokenUsage} TokenUsage */
/** @typedef {import('./model-pricing.js').ApiEquivalentCost} ApiEquivalentCost */

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
	const { attempt, outcome, startedAt = null, filesTouched = null } = input;
	const danielCorrections = input.danielCorrections ?? null;
	const rejectedBefore = input.rejectedBefore ?? null;
	return {
		schemaVersion: RUN_SCHEMA_VERSION,
		source: input.source,
		id: input.id,
		taskId: input.taskId,
		chainId: input.chainId,
		taskType: input.taskType,
		project: input.project,
		provider: input.provider,
		model: input.model,
		effort: input.effort,
		startedAt,
		finishedAt: input.finishedAt,
		wallTimeMs:
			startedAt === null ? null : Math.max(0, Date.parse(input.finishedAt) - Date.parse(startedAt)),
		outcome,
		attempt,
		retries: attempt === null ? null : attempt - 1,
		escalations: input.escalations ?? null,
		firstTry: outcome === 'done' && attempt === 1 && (danielCorrections ?? 0) === 0,
		estimatedDifficulty: input.estimatedDifficulty ?? null,
		measuredDifficulty: difficultyForFiles(filesTouched),
		filesTouched,
		danielCorrections,
		rejectedBefore,
		reworked: outcome === 'done' && rejectedBefore === true,
		...runAccounting(input)
	};
}

/** @param {RunRecordInput} input */
function runAccounting(input) {
	const { usage } = input;
	const cost = input.cost ?? estimateApiCost(input.model, usage);
	return {
		inputTokens: usage?.inputTokens ?? null,
		outputTokens: usage?.outputTokens ?? null,
		cacheReadTokens: usage?.cacheReadTokens ?? null,
		cacheWriteTokens: usage?.cacheWriteTokens ?? null,
		apiEquivalentUsd: cost.usd,
		apiEquivalentMinUsd: cost.minimumUsd,
		apiEquivalentMaxUsd: cost.maximumUsd,
		apiEquivalentBasis: cost.basis,
		rateCard: cost.rateCard,
		actualUsd: input.actualUsd ?? null,
		codexCredits: input.codexCredits ?? null
	};
}

/** @typedef {ReturnType<typeof createRunRecord>} RunRecord */
