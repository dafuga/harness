// @harness-uid u_b4uzqkb2i6
import type { ModuleTaskRepository } from '../../../repositories/agents-providers/ModuleTaskRepository';
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { readCooldowns } from './providerCooldown';
import { claimable, claimedTask } from './taskClaim';
import { taskBlockers, workspacePreflight } from './taskPreflight';

/**
 * Claims the first task this machine can run. Infrastructure problems are found before a claim,
 * so a blocked dispatch charges no attempt and leaves the task queued for a capable worker.
 */
export async function preflightClaim(
	root: string,
	repository: ModuleTaskRepository,
	worker: string,
	modules: string[]
): Promise<{ claim?: { value: ModuleTask | null; commit?: string }; blocked: string[] }> {
	const workspace = await workspacePreflight(root);
	if (workspace.length) return { blocked: workspace };
	const cooldowns = await readCooldowns(root);
	const queue = (await repository.read()).data;
	const blocked = new Map<string, string[]>();
	for (const task of queue.tasks.filter((item) => claimable(item, worker, modules))) {
		const problems = await taskBlockers(task, cooldowns);
		if (problems.length) blocked.set(task.id, problems);
	}
	const owner = await repository.owner();
	const claim = await repository.update((current) =>
		claimedTask(current, worker, modules, { owner, blocked: new Set(blocked.keys()) })
	);
	return {
		claim,
		blocked: [...blocked].map(([task, problems]) => `${task}: ${problems.join(' ')}`)
	};
}
