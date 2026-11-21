// @harness-uid u_g7kdpz7bel
import type { TrackerItemMutationContext } from '../../utils/projects-sessions/planTrackerItemMutation.types';

export interface TrackerLocalApiOptions {
	now?: () => number;
	timeZone?: string;
	validateModel?: TrackerItemMutationContext['validateModel'];
	planLaunch?: TrackerItemMutationContext['planLaunch'];
}
