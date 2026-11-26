// @harness-uid u_qhdifpyhqs
import type { HomeAgent, HomeAgentTask, HomeOpenAsk, OwnerHomeSnapshot } from './hubHome.types';
import { agentOpenAsks, askChatAgents, withListedAsk } from './homeOpenAsks';
import type { HomeLists } from './homeDirectAgents.types';
export type { HomeLists } from './homeDirectAgents.types';

/**
 * The sessions Daniel creates and talks to himself, by Tracker agent value, with the name Home
 * shows. Daniel can add more; every other Tracker project is worked by sessions that agents
 * created, which are counted under a listed agent and never listed themselves.
 */
export const directAgentNames: Readonly<Record<string, string>> = { cos: 'Chief of Staff' };

/** Tracker agent values Daniel may add as user-controlled sessions. */
export const controlledIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export const noSubAgents = (): HomeAgent['subAgents'] => ({ sessions: 0, tasks: [] });

export function isDirectAgent(
	agent: Pick<HomeAgent, 'id' | 'name'>,
	added: readonly string[] = []
): boolean {
	return (
		agent.id in directAgentNames ||
		Object.values(directAgentNames).includes(agent.name) ||
		added.includes(agent.id)
	);
}

/**
 * Keeps only user-controlled agents in the list. The live sessions of every other project are
 * folded into the first listed agent as its sub-agents, so working counts survive without a row
 * each, and every other project that needs Daniel stays reachable as an ask.
 */
export function listHomeAgents(agents: HomeAgent[], added: readonly string[] = []): HomeLists {
	const direct = agents.filter((agent) => isDirectAgent(agent, added));
	const rest = agents.filter((agent) => !isDirectAgent(agent, added));
	return {
		agents: direct.map((agent, index) => {
			const named = { ...agent, name: directAgentNames[agent.id] ?? agent.name };
			return index === 0 && rest.length ? withSubAgents(named, rest) : named;
		}),
		asks: rest.filter((agent) => agent.state === 'needs-you')
	};
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

/** A computer's snapshot with the fields older Mac apps omit filled in. */
export function completeHomeSnapshot(
	snapshot: OwnerHomeSnapshot
): OwnerHomeSnapshot & { openAsks: HomeOpenAsk[] } {
	const openAsks = snapshot.openAsks ?? agentOpenAsks(snapshot.agents);
	return {
		...snapshot,
		openAsks,
		agents: snapshot.agents.map((agent) =>
			withListedAsk(
				{
					...agent,
					sessions: agent.sessions ?? 0,
					tasks: agent.tasks ?? [],
					subAgents: agent.subAgents ?? noSubAgents()
				},
				openAsks
			)
		)
	};
}

/** What Home shows for a raw snapshot, whatever version of the Mac app wrote it. */
export function listedHomeSnapshot(
	snapshot: OwnerHomeSnapshot,
	added: readonly string[] = []
): OwnerHomeSnapshot & HomeLists & { openAsks: HomeOpenAsk[] } {
	const complete = completeHomeSnapshot(snapshot);
	const agents = [...complete.agents, ...askChatAgents(complete.agents, complete.openAsks)];
	return {
		...complete,
		...listHomeAgents(agents, added),
		openAsks: complete.openAsks.map((ask) => ({
			...ask,
			agentName: directAgentNames[ask.agentId] ?? ask.agentName
		}))
	};
}
