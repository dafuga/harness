import type { HomeAgent } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { noSubAgents } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
import { agentSessions, count, isWorking } from './hubHomePresentation';
import type { HubDockModel, HubDockSource } from './hubDockModel.types';

/** Chief of Staff is always reachable, even before the Tracker reports anything for it. */
function chiefPlaceholder(now: number): HomeAgent {
	return {
		id: 'cos',
		name: 'Chief of Staff',
		state: 'idle',
		sessions: 0,
		tasks: [],
		subAgents: noSubAgents(),
		itemId: null,
		task: 'No current Tracker item',
		machine: null,
		model: null,
		since: new Date(now).toISOString(),
		question: null,
		messages: []
	};
}

/** @pure What a working agent is doing, in one line. */
export function dockActivity(agent: HomeAgent): string {
	const watched = agent.subAgents.sessions;
	if (agent.id === 'cos' && watched) return `Watching ${count(watched, 'session')}`;
	const task = agent.tasks[0]?.title ?? agent.subAgents.tasks[0]?.title ?? agent.task;
	const total = agentSessions(agent);
	return total > 1 ? `${task} (+${total - 1} more)` : task;
}

/** @pure The dock's two groups. An agent with a question is listed once, under the question. */
export function hubDockModel(source: HubDockSource, now: number): HubDockModel {
	const everyone = [...source.agents, ...source.asks];
	const asking: HubDockModel['asking'] = [];
	const oldestFirst = [...source.openAsks].sort(
		(a, b) => Date.parse(a.since) - Date.parse(b.since)
	);
	for (const ask of oldestFirst) {
		const agent = everyone.find((entry) => entry.id === ask.agentId);
		if (agent && !asking.some((entry) => entry.agent.id === agent.id))
			asking.push({ agent, line: ask.question, since: ask.since });
	}
	const asked = new Set(asking.map((entry) => entry.agent.id));
	const working = source.agents
		.filter((agent) => !asked.has(agent.id) && isWorking(agent))
		.map((agent) => ({ agent, line: dockActivity(agent) }));
	const chief = everyone.find((agent) => agent.id === 'cos') ?? chiefPlaceholder(now);
	const others = everyone.filter((agent) => agent.id !== 'cos' && agent.itemId);
	return { asking, working, reachable: [chief, ...others] };
}

/** @pure How long a question has waited: "12m", "2h 14m" or "3d 4h". */
export function dockWait(since: string, now: number): string {
	const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
	if (minutes < 60) return `${minutes}m`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
	return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

/** @pure The count shown on the closed dock, or nothing when no one is asking or working. */
export function dockPillText({ asking, working }: HubDockModel): string | null {
	if (asking.length === 1) return '1 has a question';
	if (asking.length) return `${asking.length} have questions`;
	return working.length ? `${working.length} working` : null;
}

/** @pure The line under the open dock's title. */
export function dockSummary({ asking, working }: HubDockModel): string {
	const questions = asking.length === 1 ? '1 has a question' : `${asking.length} have questions`;
	return `${asking.length ? questions : 'No questions'} · ${working.length} working`;
}
