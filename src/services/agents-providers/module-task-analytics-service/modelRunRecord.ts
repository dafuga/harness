// @harness-uid u_hxkpkiert2
import { estimateApiCost } from './modelRunPricing';

export const RUN_SCHEMA_VERSION = 1;

import type { Difficulty, RunRecord, RunRecordInput } from './modelRunRecord.types';

export function difficultyForFiles(files: number): Difficulty {
	if (files <= 2) return 'small';
	return files <= 8 ? 'medium' : 'large';
}

export function createRunRecord(input: RunRecordInput): RunRecord {
	const filesTouched = input.filesTouched ?? null;
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
		...timingAndOutcome(input),
		estimatedDifficulty: input.estimatedDifficulty ?? null,
		measuredDifficulty: filesTouched === null ? null : difficultyForFiles(filesTouched),
		filesTouched,
		moduleId: input.moduleId ?? null,
		linesChanged: input.linesChanged ?? null,
		rejectionCause: input.rejectionCause ?? null,
		...usageAndCost(input),
		actualUsd: input.actualUsd ?? null,
		codexCredits: input.codexCredits ?? null
	};
}

function timingAndOutcome(input: RunRecordInput) {
	const {
		finishedAt,
		outcome,
		attempt,
		startedAt = null,
		escalations = null,
		danielCorrections = null,
		rejectedBefore = null
	} = input;
	return {
		startedAt,
		finishedAt,
		wallTimeMs:
			startedAt === null ? null : Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
		outcome,
		attempt,
		retries: attempt === null ? null : attempt - 1,
		escalations,
		firstTry: outcome === 'done' && attempt === 1 && !danielCorrections,
		danielCorrections,
		rejectedBefore,
		reworked: outcome === 'done' && rejectedBefore === true
	};
}

function usageAndCost(input: RunRecordInput) {
	const { usage, cost = estimateApiCost(input.model, usage) } = input;
	return {
		inputTokens: usage?.inputTokens ?? null,
		outputTokens: usage?.outputTokens ?? null,
		cacheReadTokens: usage?.cacheReadTokens ?? null,
		cacheWriteTokens: usage?.cacheWriteTokens ?? null,
		apiEquivalentUsd: cost.usd,
		apiEquivalentMinUsd: cost.minimumUsd,
		apiEquivalentMaxUsd: cost.maximumUsd,
		apiEquivalentBasis: cost.basis,
		rateCard: cost.rateCard
	};
}
