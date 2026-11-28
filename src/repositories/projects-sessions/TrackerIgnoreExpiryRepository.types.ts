// @harness-uid u_k2n3yjm2vr
import type { TrackerItemFields } from '../../utils/projects-sessions/normalizeTrackerItemFields.types';
import type { TrackerIgnoredItem } from '../../utils/projects-sessions/planTrackerIgnoreExpiry.types';

export type TrackerIgnoreExpiryPlan = (item: TrackerIgnoredItem) => TrackerItemFields | undefined;
