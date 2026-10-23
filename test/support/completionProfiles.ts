import { TaskCommand } from '../../src/cli/program/TaskCommand';
import { newLoopState } from '../../src/cli/program/manage-loop/newLoopState';
import {
	TaskCompletionService,
	type TaskAudit
} from '../../src/services/verification-evidence/TaskCompletionService';
import { codeAudit } from '../../src/services/verification-evidence/task-completion-service/codeAudit';
import { planAudit } from '../../src/services/verification-evidence/task-completion-service/planAudit';
import { sourceAudit } from '../../src/services/verification-evidence/task-completion-service/sourceAudit';
import { taskAuditRecord } from '../../src/services/verification-evidence/task-completion-service/taskAuditRecord';
import { evidenceRequested } from '../../src/utils/reports-media/record-capture/recordCapture';
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
	await taskProfile('command.task', 'audit-explicit-planning-loop', () =>
		new TaskCommand(root).run({ loop })
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
