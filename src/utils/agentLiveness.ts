export interface AgentFacts {
	registeredAt: string;
	heartbeatAt: string;
	ttlSeconds: number;
	pid: number | null;
	processStartedAt: string | null;
	finished: { status: 'completed' | 'failed'; at: string } | null;
}

/** What the system says of a process; `exists` is undefined when it could not be asked. */
export interface ProcessFacts {
	exists: boolean | undefined;
	startedAt: string | null;
}

export { agentLiveness } from '../services/agent-activity-service/agentLiveness';
