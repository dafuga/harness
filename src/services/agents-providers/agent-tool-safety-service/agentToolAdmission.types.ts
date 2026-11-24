import type {
	AgentToolAction,
	AgentToolPolicy,
	PreparedAgentTool
} from '../AgentToolSafetyService.types';

export interface AgentToolAdmission {
	agentId: string;
	tool: string;
	action: AgentToolAction;
	prepared: PreparedAgentTool;
	policy: AgentToolPolicy;
	proposal: string;
}
