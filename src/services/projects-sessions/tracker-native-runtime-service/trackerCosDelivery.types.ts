// @harness-uid u_bl6xl2h4a3
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

/** A private transport record for the one plain notice about a stalled review queue. */
export interface TrackerCosSafetyNotice {
	generation: string;
	count: number;
	emergency: boolean;
}

export interface TrackerCosRoundPorts {
	now(): number;
	local(): readonly TrackerWatchdogAlert[];
}
