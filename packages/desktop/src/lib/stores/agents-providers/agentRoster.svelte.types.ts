import type { LiveActivity } from '../../../../../../src/core/activityTypes';

export type Sample = Pick<LiveActivity, 'sampledAt' | 'agents'>;
