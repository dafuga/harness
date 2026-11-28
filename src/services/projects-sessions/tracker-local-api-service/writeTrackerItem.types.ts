// @harness-uid u_g7kdpz7bel
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { TrackerItemAction } from '../../../utils/projects-sessions/planTrackerItemMutation.types';

export interface TrackerItemRoute {
	id: string;
	verb: string | undefined;
	action: ('add' | TrackerItemAction) | undefined;
	manual: boolean;
	release: boolean;
}

export interface TrackerItemWrite {
	actor: string | null;
	input: TrackerItemInput;
}
