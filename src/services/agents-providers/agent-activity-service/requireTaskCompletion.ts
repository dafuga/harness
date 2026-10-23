import {
	loopPaths,
	readLoop,
	validateLoopId
} from '../../../workflows/development-tooling/loop-state/loopState';
import { TaskCompletionService } from '../../verification-evidence/TaskCompletionService';
import type { StoredAgent } from './AgentRegistryRepository';

export async function requireTaskCompletion(root: string, agent: StoredAgent): Promise<void> {
	const { task, loop: declared, units } = agent.beat;
	if (!task && !declared) return;
	const loop = declared ? validateLoopId(declared, 'Loop name') : undefined;
	const state = loop ? await readLoop(loopPaths(root, loop).state) : null;
	const completion = state?.completion;
	const goal = state ? state.goal : task;
	await new TaskCompletionService(root).require({
		kind: completion ? completion.kind : 'coding',
		goal: goal ?? '',
		plan: completion?.plan,
		loop,
		units
	});
}
