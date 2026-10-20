import type { AgentFacts, ProcessFacts } from '../../utils/agentLiveness';
import type { AgentState } from '../../core/activityTypes';

/** Why the process an agent named is not that agent any more, or undefined when it may be. */
function departed(agent: AgentFacts, found: ProcessFacts): string | undefined {
	if (found.exists === false) return `Its process ${agent.pid} ended without saying it finished`;
	const known = agent.processStartedAt !== null && found.startedAt !== null;
	return found.exists && known && found.startedAt !== agent.processStartedAt
		? `Process ${agent.pid} is another process now; the one that registered has ended`
		: undefined;
}

/**
 * Whether a registered agent is working at `now`. An end is final. A process that is gone, or
 * whose number another process has, is not the agent. Otherwise only its own heartbeat counts:
 * a process that merely exists proves no work, and a heartbeat older than the agent allowed is
 * stale. The process is asked about only when the owner named one.
 */
export function agentLiveness(
	agent: AgentFacts,
	now: number,
	processOf: (pid: number) => ProcessFacts
): { state: AgentState; detail: string } {
	if (agent.finished) {
		const word = agent.finished.status === 'failed' ? 'Failed' : 'Finished';
		return { state: agent.finished.status, detail: `${word} at ${agent.finished.at}` };
	}
	const gone = agent.pid === null ? undefined : departed(agent, processOf(agent.pid));
	if (gone) return { state: 'gone', detail: gone };
	if (now - Date.parse(agent.heartbeatAt) > agent.ttlSeconds * 1000) {
		const seconds = `${agent.ttlSeconds} second${agent.ttlSeconds === 1 ? '' : 's'}`;
		const allowed = `it allowed ${seconds} between heartbeats`;
		return { state: 'stale', detail: `No heartbeat since ${agent.heartbeatAt}; ${allowed}` };
	}
	return { state: 'working', detail: `Last heartbeat at ${agent.heartbeatAt}` };
}
