// @harness-uid u_mzypaxxnyu
import type { ModuleTaskRepository } from '../../../repositories/agents-providers/ModuleTaskRepository';
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { reviewInputSchema } from '../../../repositories/agents-providers/module-task-repository/taskUsage';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { taskWrites } from '../module-task-worker-service/taskClaim';
import { ModuleTaskAnalyticsService } from '../ModuleTaskAnalyticsService';
import { acceptanceEvidence } from './acceptanceEvidence';
import { recordedReview } from './recordedReview';
/**
 * A review is bound to one submitted claim; duplicate or stale reviews cannot bounce it twice.
 * Acceptance requires verification evidence, and resending a recorded verdict returns it.
 */
export async function reviewModuleTask(
	root: string,
	repository: ModuleTaskRepository,
	id: string,
	input: unknown
) {
	const review = reviewInputSchema.parse(input);
	const snapshot = await repository.read();
	const before = snapshot.data.tasks.find((task) => task.id === id);
	const replay = recordedReview(before, review);
	if (replay) return { commit: snapshot.commit, task: before!, replayed: true };
	if (before?.status !== 'review' || before.claim?.token !== review.attempt || !before.result)
		throw new Error('Task is not awaiting this attempt review.');
	const evidence =
		review.verdict === 'accepted'
			? await acceptanceEvidence(root, before, review.evidence!)
			: undefined;
	const checkpoint = await repairCheckpoint(root, before, review.verdict);
	const result = await repository.update((queue) => {
		const task = queue.tasks.find((item) => item.id === id);
		if (
			task?.status !== 'review' ||
			task.claim?.token !== review.attempt ||
			task.contractHash !== before.contractHash ||
			!task.result
		)
			throw new Error('Task review is stale; no result was overwritten.');
		const { attempt, verdict, cause, reviewer, feedback } = review;
		task.reviews.push({
			...{ attempt, verdict, reviewer, feedback, ...(cause ? { cause } : {}) },
			...(evidence ? { evidence } : {}),
			at: new Date().toISOString(),
			provider: task.result.provider,
			model: task.result.model,
			intelligence: task.result.intelligence,
			reportedModel: task.result.reportedModel
		});
		if (review.verdict === 'accepted') task.status = 'accepted';
		else {
			task.attempts.push(task.result);
			task.claimHistory.push(task.claim);
			task.repairCommit = checkpoint;
			task.status = 'queued';
			delete task.result;
			delete task.claim;
		}
		return task;
	}, checkpoint);
	await new ModuleTaskAnalyticsService().sync(root);
	return { commit: result.commit, task: result.value, replayed: false };
}

async function repairCheckpoint(root: string, task: ModuleTask, verdict: string) {
	const result = task.result!;
	if (verdict !== 'incomplete' || result.checkpointCommit) return result.checkpointCommit;
	const source = result.sourceCommit ?? task.sourceCommit;
	const paths = await taskWrites(new GitAdapter(result.worktree), {
		...task,
		sourceCommit: source
	});
	return new ModuleTaskWorktreeAdapter(root).checkpoint({
		cwd: result.worktree,
		source,
		paths
	});
}
