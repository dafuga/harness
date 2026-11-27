// @harness-uid u_3n5vo4mix3
import { randomUUID } from 'node:crypto';
import {
	admitAgentTool,
	agentToolContentDenial,
	allowsAgentTool
} from './agent-tool-safety-service/agentToolAdmission';
import { reserveAgentTool } from './agent-tool-safety-service/reserveAgentTool';
import type { AgentToolAdmission } from './agent-tool-safety-service/agentToolAdmission.types';
import type {
	AgentToolDecision,
	AgentToolDenial,
	AgentToolEvent,
	AgentToolSafetyOptions
} from './AgentToolSafetyService.types';

/** Dispatches model tool proposals within current host grants and durable human approvals. */
export class AgentToolSafetyService {
	constructor(private readonly options: AgentToolSafetyOptions) {}

	/** Submit an untrusted JSON proposal. Only the owner channel can call approve. */
	submit(agentId: string, proposal: string): Promise<AgentToolDecision> {
		return this.dispatch(agentId, proposal);
	}

	/** Execute the exact action approved by the authenticated owner. */
	approve(agentId: string, approvalId: string, proposal: string): Promise<AgentToolDecision> {
		return this.dispatch(agentId, proposal, approvalId ?? '');
	}

	private now(): number {
		return this.options.now?.() ?? Date.now();
	}

	private record(event: AgentToolEvent): void {
		this.options.journal.transaction((journal) => journal.append(event));
	}

	private async dispatch(
		agentId: string,
		proposal: string,
		approvalId?: string
	): Promise<AgentToolDecision> {
		try {
			const attempt = { agentId, attemptId: randomUUID(), at: this.now() };
			this.record({ ...attempt, state: 'requested' });
			const admitted = this.admit(agentId, proposal);
			if (typeof admitted === 'string') return this.deny(attempt, admitted);
			const toolAttempt = { ...attempt, tool: admitted.tool };
			const denial = await agentToolContentDenial(this.options, admitted);
			if (denial) return this.deny(toolAttempt, denial);
			return await this.dispatchAdmitted(toolAttempt, admitted, approvalId);
		} catch {
			return { status: 'denied', reason: 'journal-unavailable' };
		}
	}

	private admit(agentId: string, proposal: string): AgentToolAdmission | AgentToolDenial {
		try {
			return admitAgentTool(this.options, agentId, proposal);
		} catch {
			return 'not-authorized';
		}
	}

	private deny(
		attempt: Pick<AgentToolEvent, 'agentId' | 'attemptId' | 'tool'>,
		reason: AgentToolDenial
	): AgentToolDecision {
		this.record({ ...attempt, at: this.now(), state: 'denied', reason });
		return { status: 'denied', reason };
	}

	private async dispatchAdmitted(
		attempt: Pick<AgentToolEvent, 'agentId' | 'attemptId' | 'tool'>,
		admitted: AgentToolAdmission,
		approvalId?: string
	): Promise<AgentToolDecision> {
		const decision = this.options.journal.transaction((journal) => {
			const current = this.currentPolicy(admitted);
			const event = { ...attempt, at: this.now() };
			const result = current
				? reserveAgentTool(journal, event, { ...admitted, policy: current }, approvalId)
				: { status: 'denied' as const, reason: 'not-authorized' as const };
			if (result?.status === 'denied')
				journal.append({ ...event, state: 'denied', reason: result.reason });
			return result;
		});
		return decision ?? this.execute(attempt, admitted);
	}

	private currentPolicy(admitted: AgentToolAdmission) {
		try {
			const current = this.options.policy(admitted.agentId);
			return allowsAgentTool(current, admitted) ? current : undefined;
		} catch {
			return undefined;
		}
	}

	private async execute(
		attempt: Pick<AgentToolEvent, 'agentId' | 'attemptId' | 'tool'>,
		admitted: AgentToolAdmission
	): Promise<AgentToolDecision> {
		const assertCurrent = () => {
			if (!this.currentPolicy(admitted)) throw new Error('Tool authorization changed.');
		};
		let decision: AgentToolDecision;
		try {
			assertCurrent();
			decision = { status: 'executed', output: await admitted.prepared.execute(assertCurrent) };
		} catch {
			decision = { status: 'failed' };
		}
		try {
			const state = decision.status === 'executed' ? 'completed' : 'failed';
			this.record({ ...attempt, at: this.now(), state });
			return decision;
		} catch {
			return { status: 'failed' };
		}
	}
}
