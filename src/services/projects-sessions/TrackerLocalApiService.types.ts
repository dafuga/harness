// @harness-uid u_g7kdpz7bel
import type { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerItem } from '../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerLadderConfig } from '../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerItemMutationContext } from '../../utils/projects-sessions/planTrackerItemMutation.types';

export interface TrackerLocalApiOptions {
	now?: () => number;
	manualLaunch?: boolean;
	timeZone?: string;
	runs?: TrackerRunReadRepository;
	schedulePreview?(item: TrackerItem): string | null;
	recurring?: {
		role: 'hub' | 'spoke';
		history?: (id: string, limit: number) => unknown;
	};
	ladderConfig?: TrackerLadderConfig;
	validateModel?: TrackerItemMutationContext['validateModel'];
	planLaunch?: TrackerItemMutationContext['planLaunch'];
}
