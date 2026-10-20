/** What an owner may say about an agent, as the command line gives it. */
export interface AgentInput {
	id?: string;
	label?: string;
	provider?: string;
	model?: string;
	task?: string;
	loop?: string;
	/** Unit ids, separated by commas. */
	units?: string;
	pid?: string;
	/** Seconds the agent may be quiet between heartbeats. */
	ttl?: string;
	outcome?: string;
}

export interface AgentStatement {
	id?: string;
	label?: string;
	provider?: string;
	model?: string;
	task?: string;
	loop?: string;
	units?: string[];
	pid: number | null;
	ttlSeconds: number;
	outcome?: string;
}

export { agentStatement } from '../services/agent-activity-service/agentStatement';
