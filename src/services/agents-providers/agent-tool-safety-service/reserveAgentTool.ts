// @harness-uid u_ztf5s6newj
import { createHash, randomUUID } from 'node:crypto';
import type {
	AgentToolApproval,
	AgentToolDecision,
	AgentToolDenial,
	AgentToolEvent,
	AgentToolJournalTransaction,
	AgentToolPolicy
} from '../AgentToolSafetyService.types';
import type { AgentToolAdmission } from './agentToolAdmission.types';

const minuteMs = 60_000;
const approvalTtlMs = 5 * minuteMs;

export function requiresAgentToolApproval(action: AgentToolAdmission['action']): boolean {
	return action !== 'file-read' && action !== 'network-read';
}

function fingerprint(admission: AgentToolAdmission): string {
	const { agentId, action, policy, prepared, proposal } = admission;
	const binding = [
		agentId,
		policy.revision,
		policy.specialty,
		action,
		prepared.resource,
		prepared.summary,
		prepared.content,
		prepared.charge?.currency,
		prepared.charge?.maximum,
		proposal
	];
	return createHash('sha256').update(JSON.stringify(binding)).digest('hex');
}

function budgetDenial(
	journal: AgentToolJournalTransaction,
	attempt: Pick<AgentToolEvent, 'at' | 'agentId'>,
	policy: AgentToolPolicy,
	charge: AgentToolAdmission['prepared']['charge']
): AgentToolDenial | undefined {
	const usage = journal.usage(attempt.agentId, attempt.at - minuteMs, charge?.currency);
	if (!Number.isSafeInteger(policy.maxCallsPerMinute) || usage.count >= policy.maxCallsPerMinute)
		return 'rate-limit';
	if (!charge) return undefined;
	return spendDenial(policy.budgets, charge, usage.spend);
}

function spendDenial(
	budgets: AgentToolPolicy['budgets'],
	charge: NonNullable<AgentToolAdmission['prepared']['charge']>,
	spend: number
): AgentToolDenial | undefined {
	const budget = Object.hasOwn(budgets ?? {}, charge.currency)
		? budgets?.[charge.currency]
		: undefined;
	if (!budget || !Number.isSafeInteger(budget.perAction) || !Number.isSafeInteger(budget.lifetime))
		return 'spend-limit';
	if (charge.maximum > budget.perAction || charge.maximum > budget.lifetime - spend)
		return 'spend-limit';
	return undefined;
}

export function reserveAgentTool(
	journal: AgentToolJournalTransaction,
	attempt: Pick<AgentToolEvent, 'at' | 'agentId' | 'attemptId' | 'tool'>,
	admission: AgentToolAdmission,
	approvalId?: string
): Exclude<AgentToolDecision, { status: 'executed' | 'failed' }> | undefined {
	const { action, policy, prepared } = admission;
	const { charge, summary } = prepared;
	const denial = budgetDenial(journal, attempt, policy, charge);
	if (denial) return { status: 'denied', reason: denial };
	if (approvalId !== undefined && !validApproval(journal.pending(approvalId), attempt, admission))
		return { status: 'denied', reason: 'approval-invalid' };
	if (requiresAgentToolApproval(action) && approvalId === undefined) {
		const approval = {
			id: randomUUID(),
			agentId: attempt.agentId,
			expiresAt: attempt.at + approvalTtlMs,
			fingerprint: fingerprint(admission)
		};
		journal.append({ ...attempt, state: 'held', approval });
		return {
			status: 'held',
			review: { id: approval.id, expiresAt: approval.expiresAt, action, summary, charge }
		};
	}
	journal.append({ ...attempt, state: 'reserved', approvalId, charge });
	return undefined;
}

function validApproval(
	approval: AgentToolApproval | undefined,
	attempt: Pick<AgentToolEvent, 'at' | 'agentId'>,
	admission: AgentToolAdmission
): boolean {
	return (
		!!approval &&
		approval.agentId === attempt.agentId &&
		approval.expiresAt > attempt.at &&
		approval.fingerprint === fingerprint(admission)
	);
}
