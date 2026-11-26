// @harness-uid u_ltornfrpah
import type { TrackerRecurringJobRequest } from '../../../services/projects-sessions/TrackerRecurringService.types';

export type JobCommand = Omit<TrackerRecurringJobRequest, 'key'>;
