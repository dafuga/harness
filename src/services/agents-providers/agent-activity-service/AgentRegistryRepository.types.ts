import type { AgentRegistration } from '../../../core/projects-sessions/activityTypes';
import type { AgentBeat } from '../../../core/projects-sessions/activityTypes';
import type { AgentEnd } from '../../../core/projects-sessions/activityTypes';

export interface StoredAgent {
	registration: AgentRegistration;
	beat: AgentBeat;
	end: AgentEnd | null;
}
