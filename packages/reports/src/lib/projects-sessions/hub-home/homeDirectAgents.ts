// @harness-uid u_qhdifpyhqs
import type { HomeAgent, HomeAgentTask, OwnerHomeSnapshot } from './hubHome.types';

/**
 * The agents Daniel talks to himself, by Tracker agent value, with the name Home shows.
 * Every other Tracker project is worked by sub-agent sessions, which are not listed as agents.
 */
export const directAgentNames: Readonly<Record<string, string>> = { cos: 'Chief of Staff' };

export function isDirectAgent(agent: Pick<HomeAgent, 'id' | 'name'>): boolean {
	return agent.id in directAgentNames || Object.values(directAgentNames).includes(agent.name);
}

export const noSubAgents = (): HomeAgent['subAgents'] => ({ sessions: 0, tasks: [] });

/**
 * Keeps only directly-addressed agents. The live sessions of every other project are folded
 * into the first direct agent as its sub-agents, so working counts survive without a row each.
 */
export function directAgentsOnly(agents: HomeAgent[]): HomeAgent[] {
	const direct = agents.filter(isDirectAgent);
	const rest = agents.filter((agent) => !isDirectAgent(agent));
	return direct.map((agent, index) => {
		const named = { ...agent, name: directAgentNames[agent.id] ?? agent.name };
		return index === 0 && rest.length ? withSubAgents(named, rest) : named;
	});
}

function withSubAgents(parent: HomeAgent, rest: HomeAgent[]): HomeAgent {
	const sessions = parent.subAgents.sessions + rest.reduce((sum, agent) => sum + agent.sessions, 0);
	const tasks: HomeAgentTask[] = [
		...parent.subAgents.tasks,
		...rest.flatMap((agent) => agent.tasks)
	];
	const state =
		sessions > 0 && ['idle', 'offline'].includes(parent.state) ? 'working' : parent.state;
	return { ...parent, state, subAgents: { sessions, tasks: tasks.slice(0, 5) } };
}

/** A computer's Home snapshot as the Hub lists it, whatever version of the Mac app wrote it. */
export function directHomeSnapshot(snapshot: OwnerHomeSnapshot): OwnerHomeSnapshot {
	const agents = snapshot.agents.map((agent) => ({
		...agent,
		sessions: agent.sessions ?? 0,
		tasks: agent.tasks ?? [],
		subAgents: agent.subAgents ?? noSubAgents()
	}));
	return { ...snapshot, agents: directAgentsOnly(agents) };
}
