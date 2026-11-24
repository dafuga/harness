// @harness-uid u_xm3geixk5t
import type {
	AgentToolDenial,
	AgentToolPolicy,
	AgentToolSafetyOptions,
	PreparedAgentTool
} from '../AgentToolSafetyService.types';
import type { AgentToolAdmission } from './agentToolAdmission.types';

const maxProposalLength = 32_768;

function parse(proposal: string): { tool: string; input: unknown } | undefined {
	if (typeof proposal !== 'string' || proposal.length > maxProposalLength) return undefined;
	try {
		return parseEnvelope(JSON.parse(proposal));
	} catch {
		return undefined;
	}
}

function parseEnvelope(value: unknown): { tool: string; input: unknown } | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	if (!('tool' in value) || !('input' in value) || Object.keys(value).length !== 2)
		return undefined;
	if (typeof value.tool !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(value.tool))
		return undefined;
	return { tool: value.tool, input: value.input };
}

export function allowsAgentTool(
	policy: AgentToolPolicy | undefined,
	admission: AgentToolAdmission
): policy is AgentToolPolicy {
	return (
		policy?.revision === admission.policy.revision &&
		policy.specialty === admission.policy.specialty &&
		policy.declaredTools.includes(admission.tool) &&
		policy.grants.some(
			({ tool, resource }) => tool === admission.tool && resource === admission.prepared.resource
		)
	);
}

export function admitAgentTool(
	options: AgentToolSafetyOptions,
	agentId: string,
	proposal: string
): AgentToolAdmission | AgentToolDenial {
	const parsed = parse(proposal);
	if (!parsed) return 'invalid-proposal';
	if (!Object.hasOwn(options.tools, parsed.tool)) return 'unknown-tool';
	const { action, prepare } = options.tools[parsed.tool];
	const policy = options.policy(agentId);
	if (!policy?.declaredTools.includes(parsed.tool)) return 'not-authorized';
	try {
		const prepared = prepare(parsed.input);
		if (!validPrepared(action, prepared)) return 'invalid-proposal';
		const admission = {
			agentId,
			tool: parsed.tool,
			action,
			prepared: { ...prepared, charge: prepared.charge },
			policy: { ...policy },
			proposal
		};
		return allowsAgentTool(policy, admission) ? admission : 'not-authorized';
	} catch {
		return 'invalid-proposal';
	}
}

function validPrepared(
	action: AgentToolAdmission['action'],
	prepared: PreparedAgentTool | undefined
): prepared is PreparedAgentTool {
	return !!prepared?.resource && !!prepared.summary && validCharge(action, prepared.charge);
}

function validCharge(
	action: AgentToolAdmission['action'],
	charge: AgentToolAdmission['prepared']['charge']
): boolean {
	if (charge)
		return (
			/^[A-Z][A-Z0-9]{1,15}$/.test(charge.currency) &&
			Number.isSafeInteger(charge.maximum) &&
			charge.maximum > 0
		);
	return action !== 'payment';
}

export async function agentToolContentDenial(
	options: AgentToolSafetyOptions,
	admission: AgentToolAdmission
): Promise<AgentToolDenial | undefined> {
	const { action, prepared, policy } = admission;
	const required = action === 'message' || action === 'publish' || action === 'external-output';
	if (!required && prepared.content === undefined) return undefined;
	if (typeof prepared.content !== 'string' || !options.checkContent) return 'content-unavailable';
	try {
		if (
			(await options.checkContent(prepared.content, { specialty: policy.specialty, action })) ===
			true
		)
			return undefined;
		return 'content-rejected';
	} catch {
		return 'content-unavailable';
	}
}
