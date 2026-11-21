// @harness-uid u_g7kdpz7bel
import type { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerLadderConfig } from '../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerItemMutationContext } from '../../utils/projects-sessions/planTrackerItemMutation.types';

export interface TrackerLocalApiOptions {
	now?: () => number;
	timeZone?: string;
	runs?: TrackerRunReadRepository;
	recurring?: {
		role: 'hub' | 'spoke';
		history?: (id: string, limit: number) => unknown;
	};
	ladderConfig?: TrackerLadderConfig;
	validateModel?: TrackerItemMutationContext['validateModel'];
	planLaunch?: TrackerItemMutationContext['planLaunch'];
}
