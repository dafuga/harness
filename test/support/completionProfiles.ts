import { TaskCompletionService, type TaskAudit } from '../../src/services/TaskCompletionService';
import { planAudit } from '../../src/services/task-completion-service/planAudit';
import { sourceAudit } from '../../src/services/task-completion-service/sourceAudit';
import { codeAudit } from '../../src/services/task-completion-service/codeAudit';
import { taskAuditRecord } from '../../src/services/task-completion-service/taskAuditRecord';
import { requireTaskCompletion } from '../../src/services/agent-activity-service/requireTaskCompletion';
import { AgentActivityService } from '../../src/services/agent-activity-service/AgentActivityService';
import { TaskCommand } from '../../src/commands/TaskCommand';
import { newLoopState } from '../../src/workflows/loop-state/newLoopState';
import { evidenceRequested } from '../../src/utils/record-capture/recordCapture';
import { completeProposal } from './taskAuditRepo';
import { taskProfile } from './taskProfiles';
const planning = { kind: 'planning' as const, goal: 'Plan catalog search', plan: 'plan.md' };

/** Plan inspection measures the auditor, without executing the proposed search implementation. */
export async function profilePlanningCompletion(root: string, audit: TaskAudit) {
	if (!evidenceRequested()) return;
	await taskProfile('service.task-completion', 'committed-plan-audit', () =>
		new TaskCompletionService(root).check(planning)
	);
	await taskProfile(
		'service.task-completion-service-plan-audit',
		'complete-catalog-proposal',
		() => planAudit(completeProposal, planning.goal),
		50
	);
	await taskProfile('service.task-completion-service-source-audit', 'committed-plan-source', () =>
		sourceAudit(root, planning)
	);
	await taskProfile('service.task-completion-service-task-audit-record', 'persist-plan-audit', () =>
		taskAuditRecord(root, { ...planning, commit: audit.commit, checks: audit.checks })
	);
}

export async function profilePlanningLoop(root: string, loop: string) {
	if (!evidenceRequested()) return;
	await taskProfile('workflow.loop-state-new-loop-state', 'declare-planning-loop', () =>
		newLoopState(root, {
			name: 'catalog-profile',
			...planning,
			createdAt: '2026-10-20T10:00:00Z'
		})
	);
	const service = new AgentActivityService(root, []);
	const agent = await service.register({ label: 'Isolated planning profile', loop });
	await taskProfile(
		'service.agent-activity-service-require-task-completion',
		'registered-planning-completion',
		() => requireTaskCompletion(root, agent)
	);
}

/** Real audits of the temporary repository's already verified rank change, including Git and evidence I/O. */
export async function profileCodingCompletion(root: string, commit: string) {
	if (!evidenceRequested()) return;
	await taskProfile('service.task-completion-service-code-audit', 'verified-rank-change', () =>
		codeAudit(root, commit, ['function.rank'])
	);
	await taskProfile('command.task', 'coding-completion-command', () =>
		new TaskCommand(root).run({
			kind: 'coding',
			goal: 'Change rank default seed',
			units: 'function.rank'
		})
	);
}
