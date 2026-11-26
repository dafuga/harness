// @harness-uid u_bl6xl2h4a3
import type { TrackerDispatchEvent } from '../../agents-providers/TrackerDispatcherService.types';

export type MonitorEvent = Extract<TrackerDispatchEvent, { type: 'monitor' }>;
export type VerifiedEvent = Extract<TrackerDispatchEvent, { type: 'verified' }>;

export interface VerifyJob {
	cancel: AbortController;
	verdict?: Omit<VerifiedEvent, 'usage'>;
}
