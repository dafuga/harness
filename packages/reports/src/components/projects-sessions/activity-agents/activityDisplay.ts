// @harness-uid u_ohctlckx5a
import type { AgentRoster } from '../../../../../../src/core/activityTypes';

/** How many agents are working, in words; not knowing is said, and is never a number. */
export function activityDisplay(agents: AgentRoster): string {
	if (agents.working === null) {
		return 'No agent has registered in this repository, so who is working is not known.';
	}
	const verb = agents.working === 1 ? 'agent is' : 'agents are';
	return `registered ${verb} working now. Agents that do not register are not counted.`;
}
