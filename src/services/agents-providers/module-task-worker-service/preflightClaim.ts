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
	options: { modules: string[]; allowTaskChecks?: boolean }
): Promise<{ claim?: { value: ModuleTask | null; commit?: string }; blocked: string[] }> {
	const { modules, allowTaskChecks } = options;
	const workspace = await workspacePreflight(root);
	if (workspace.length) return { blocked: workspace };
	const cooldowns = await readCooldowns(root);
	const queue = (await repository.read()).data;
	const blocked = new Map<string, string[]>();
	const runnable = new Set<string>();
	for (const task of queue.tasks.filter((item) => claimable(item, worker, modules))) {
		const problems = await taskBlockers(task, cooldowns);
		if (task.check && !allowTaskChecks)
			problems.push(
				'This task declares a host check. Use --allow-task-checks for a trusted queue.'
			);
		if (task.check && task.platform === 'linux')
			problems.push('Host checks with session repair require a native provider task.');
		if (problems.length) blocked.set(task.id, problems);
		else runnable.add(task.id);
	}
	const owner = await repository.owner();
	// A task queued after the preflight read waits for the next poll's preflight.
	const claim = await repository.update((current) =>
		claimedTask(current, worker, modules, { owner, runnable })
	);
	return {
		claim,
		blocked: [...blocked].map(([task, problems]) => `${task}: ${problems.join(' ')}`)
	};
}
