import type { AgentState } from '../../../../../src/core/activityTypes';

/** What each state of a registered agent is called. */
export const agentStates: Record<AgentState, string> = {
	working: 'Working',
	stale: 'Stale',
	gone: 'Process ended',
	completed: 'Finished',
	failed: 'Failed'
};

/** A moment as a reader compares it: the UTC day and minute.
 * Not declared pure: offset-free input strings can use the host timezone.
 */
export function activityTime(iso: string): string {
	const at = new Date(iso);
	return Number.isFinite(at.getTime()) ? at.toISOString().slice(0, 16).replace('T', ' ') : iso;
}

export { commitHref } from '../../components/projects-sessions/project-activity/activityDisplay';
export { activityDisplay } from '../../components/projects-sessions/activity-agents/activityDisplay';

export { plural } from '../../helpers/strings/plural';
