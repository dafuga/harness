import type { ModuleTaskRepository } from '../../../repositories/agents-providers/ModuleTaskRepository';
import { reviewInputSchema } from '../../../repositories/agents-providers/module-task-repository/taskUsage';
import { ModuleTaskWorktreeAdapter } from '../../../adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { taskWrites } from '../module-task-worker-service/taskClaim';
import { ModuleTaskAnalyticsService } from '../ModuleTaskAnalyticsService';
/** A review is bound to one submitted claim; duplicate or stale reviews cannot bounce it twice. */
export async function reviewModuleTask(
	root: string,
	repository: ModuleTaskRepository,
	id: string,
	input: unknown
) {
	const review = reviewInputSchema.parse(input);
	const before = (await repository.read()).data.tasks.find((task) => task.id === id);
	if (before?.status !== 'review' || before.claim?.token !== review.attempt || !before.result)
		throw new Error('Task is not awaiting this attempt review.');
	let checkpoint = before.result.checkpointCommit;
	if (review.verdict === 'incomplete' && !checkpoint) {
		const source = before.result.sourceCommit ?? before.sourceCommit;
		const paths = await taskWrites(new GitAdapter(before.result.worktree), {
			...before,
			sourceCommit: source
		});
		checkpoint = await new ModuleTaskWorktreeAdapter(root).checkpoint({
			cwd: before.result.worktree,
			source,
			paths
		});
	}
	const result = await repository.update((queue) => {
		const task = queue.tasks.find((item) => item.id === id);
		if (
			task?.status !== 'review' ||
			task.claim?.token !== review.attempt ||
			task.contractHash !== before.contractHash ||
			!task.result
		)
			throw new Error('Task review is stale; no result was overwritten.');
		task.reviews.push({
			...review,
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
	return { commit: result.commit, task: result.value };
}
