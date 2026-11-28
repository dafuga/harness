// @harness-uid u_g7kdpz7bel
import type { TrackerItemInput } from '../../../utils/projects-sessions/normalizeTrackerItemFields.types';

export interface ChiefReviewRequest {
	verb: string | undefined;
	actor: string | null;
	body: TrackerItemInput;
}
