// @harness-uid u_b4uzqkb2i6
import { constants } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { taskSelection } from '../module-task-service/taskPrompt';
import type { ProviderCooldowns } from './providerCooldown.types';

/**
 * Infrastructure a worker needs before it may claim anything: a task worktree directory it can
 * write. A sandbox that denies it (EPERM, EACCES) would fail every claimed attempt.
 */
export async function workspacePreflight(root: string): Promise<string[]> {
	const common = await new GitAdapter(root).run(['rev-parse', '--git-common-dir']);
	const directory = resolve(root, common, '..', '.cache/harness/task-worktrees');
	const probe = join(directory, `.preflight-${process.pid}`);
	try {
		await mkdir(directory, { recursive: true });
		await writeFile(probe, '');
		await rm(probe, { force: true });
		return [];
	} catch (error) {
		const code = (error as { code?: string }).code ?? 'unknown error';
		return [`Task worktree directory ${directory} is not writable (${code}).`];
	}
}

/** Why one task cannot be dispatched on this machine now; empty when it can. */
export async function taskBlockers(
	task: ModuleTask,
	cooldowns: ProviderCooldowns,
	path: string = process.env.PATH ?? ''
): Promise<string[]> {
	const { provider } = taskSelection(task);
	const blockers: string[] = [];
	const cooldown = cooldowns[provider];
	if (cooldown) blockers.push(`The ${provider} quota is exhausted until ${cooldown.until}.`);
	for (const tool of task.requiredTools ?? [])
		if (!(await executable(tool, path))) blockers.push(`Required tool ${tool} is not on PATH.`);
	return blockers;
}

async function executable(tool: string, path: string): Promise<boolean> {
	for (const directory of path.split(delimiter).filter(Boolean)) {
		try {
			await access(join(directory, tool), constants.X_OK);
			return true;
		} catch {
			/* Try the next PATH entry. */
		}
	}
	return false;
}
