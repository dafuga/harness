import type { AgentRoster, AgentState } from '../../../../src/core/activityTypes';
import { consoleRoutePath } from '../../../../src/utils/consoleRoute';

/** What each state of a registered agent is called. */
export const agentStates: Record<AgentState, string> = {
	working: 'Working',
	stale: 'Stale',
	gone: 'Process ended',
	completed: 'Finished',
	failed: 'Failed'
};

/** The history page of a commit in the console served under `base`, at its own path. */
export function commitHref(base: string, commit: string, branches: string[]): string {
	return base + consoleRoutePath({ branch: branches[0] ?? null, commit, view: 'history' });
}

/** A moment as a reader compares it: the UTC day and minute. */
export function activityTime(iso: string): string {
	const at = new Date(iso);
	return Number.isFinite(at.getTime()) ? at.toISOString().slice(0, 16).replace('T', ' ') : iso;
}

export const plural = (count: number, word: string): string =>
	`${count} ${word}${count === 1 ? '' : 's'}`;

/** How many agents are working, in words; not knowing is said, and is never a number. */
export function activityDisplay(agents: AgentRoster): string {
	if (agents.working === null) {
		return 'No agent has registered in this repository, so who is working is not known.';
	}
	const verb = agents.working === 1 ? 'agent is' : 'agents are';
	return `${agents.working} registered ${verb} working now. Agents that do not register are not counted.`;
}
