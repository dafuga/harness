// @harness-uid u_mzypaxxnyu
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';

/**
 * The review already recorded for this attempt, when the same verdict is sent again: a driver
 * that stopped after Harness committed its verdict can resend it and read the outcome. A
 * different verdict for an attempt that was already reviewed is refused.
 */
export function recordedReview(
	task: ModuleTask | undefined,
	review: { attempt: string; verdict: 'accepted' | 'incomplete' }
): ModuleTask['reviews'][number] | undefined {
	const recorded = [...(task?.reviews ?? [])]
		.reverse()
		.find((item) => item.attempt === review.attempt);
	if (!recorded) return undefined;
	if (recorded.verdict !== review.verdict)
		throw new Error(
			`Attempt ${review.attempt} was already reviewed as ${recorded.verdict}; the ${review.verdict} verdict was refused.`
		);
	return recorded;
}
