import type { AgentEntry, AgentRoster } from '../../../../src/core/activityTypes';
import { agentStates } from './activityDisplay';

/** A reading older than this says nothing about who is working now. */
export const readingAge = 60_000;

export interface ActivityReading {
	/** False once the reading is too old to describe the present. */
	current: boolean;
	/** Agents working by this reading at this moment; null when that is not known. */
	working: number | null;
	/** What an agent is called now: a recorded end stays, live work is only as good as the reading. */
	label(agent: AgentEntry): string;
}

/**
 * What a reading of the roster still says at `now`. A page that could not read again must not
 * go on calling an agent working: after its own allowance the agent is stale, and once the whole
 * reading is older than a minute nobody is counted and working agents are not confirmed.
 */
export function activityReading(
	agents: AgentRoster,
	sampledAt: string,
	now: number
): ActivityReading {
	const current = now - Date.parse(sampledAt) <= readingAge;
	const lapsed = (agent: AgentEntry) =>
		agent.state === 'working' && Date.parse(agent.expiresAt) < now;
	const stale = agents.roster.filter(lapsed).length;
	return {
		current,
		working: agents.working === null || !current ? null : agents.working - stale,
		label(agent) {
			if (agent.state !== 'working') return agentStates[agent.state];
			if (!current) return 'Not confirmed';
			return lapsed(agent) ? agentStates.stale : agentStates.working;
		}
	};
}
