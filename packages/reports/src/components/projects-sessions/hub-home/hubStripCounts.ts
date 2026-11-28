// @harness-uid u_rcoti7b7ii
import type { HomeAgent, HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { agentSessions } from './hubHomePresentation';
import type { StripCounts } from './hubStripCounts.types';

const familyOrder = ['Claude', 'Codex', 'Other'];

/** The provider family an agent's model belongs to; a missing or unknown model is Other. */
function familyOf(model: string | null): string {
	if (model === null) return 'Other';
	if (/claude|opus|sonnet|haiku|fable/i.test(model)) return 'Claude';
	if (/gpt|codex|luna|sol|terra/i.test(model)) return 'Codex';
	return 'Other';
}

/** "4 Claude · 3 Codex": only the families with live sessions, in a fixed order. */
function sessionSplit(agents: HomeAgent[]): string {
	const totals = new Map<string, number>();
	for (const agent of agents) {
		const sessions = agentSessions(agent);
		if (sessions <= 0) continue;
		const family = familyOf(agent.model);
		totals.set(family, (totals.get(family) ?? 0) + sessions);
	}
	return familyOrder
		.filter((family) => (totals.get(family) ?? 0) > 0)
		.map((family) => `${totals.get(family)} ${family}`)
		.join(' · ');
}

/** The age of a wait in whole minutes, such as "45m", "2h 14m", "3h", "2d 5h" or "1d". */
function ageOf(since: number, now: number): string {
	const minutes = Math.max(0, Math.floor((now - since) / 60000));
	if (minutes < 60) return `${minutes}m`;
	if (minutes < 1440) {
		const rest = minutes % 60;
		return `${Math.floor(minutes / 60)}h${rest ? ` ${rest}m` : ''}`;
	}
	const hours = Math.floor((minutes % 1440) / 60);
	return `${Math.floor(minutes / 1440)}d${hours ? ` ${hours}h` : ''}`;
}

/** The earliest parseable ask time in milliseconds; unparseable asks are ignored. */
function oldestWait(openAsks: HomeOpenAsk[]): number | null {
	let oldest: number | null = null;
	for (const ask of openAsks) {
		const time = Date.parse(ask.since);
		if (Number.isNaN(time)) continue;
		if (oldest === null || time < oldest) oldest = time;
	}
	return oldest;
}

function needsYouSub(openAsks: HomeOpenAsk[], now: number): string {
	if (openAsks.length === 0) return 'Nothing waiting';
	const oldest = oldestWait(openAsks);
	return oldest === null ? 'Waiting' : `Oldest waiting ${ageOf(oldest, now)}`;
}

/** @pure The Sessions running and Needs you tiles from the agents and open asks. */
export function stripCounts(
	agents: HomeAgent[],
	openAsks: HomeOpenAsk[],
	now: number
): StripCounts {
	const value = agents.reduce((total, agent) => total + agentSessions(agent), 0);
	return {
		sessions: {
			label: 'Sessions running',
			value,
			sub: value === 0 ? 'Nothing running' : sessionSplit(agents)
		},
		needsYou: {
			label: 'Needs you',
			value: openAsks.length,
			sub: needsYouSub(openAsks, now)
		}
	};
}
