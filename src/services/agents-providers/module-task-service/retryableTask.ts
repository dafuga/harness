import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import { ProcessIdentityAdapter } from '../agent-activity-service/ProcessIdentityAdapter';
export function retryableTask(task: ModuleTask, workspace: string): boolean {
	if (task.status === 'failed') return true;
	if (task.status !== 'running' || !task.claim || task.claim.owner.workspace !== workspace)
		return false;
	const facts = new ProcessIdentityAdapter().find(task.claim.owner.pid);
	return (
		facts.exists === false ||
		(facts.exists === true &&
			Boolean(facts.startedAt) &&
			facts.startedAt !== task.claim.owner.startedAt)
	);
}
