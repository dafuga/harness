// @harness-uid u_bl6xl2h4a3
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

/** The one Tracker ask that reports stuck delivery, reused across episodes. */
export interface TrackerCosDeliveryAlarm {
	itemId: string;
	open: boolean;
	askedAt: number;
}

export interface TrackerCosBusyPane {
	pane: string;
	since: number;
}

export interface TrackerCosRoundPorts {
	now(): number;
	local(): readonly TrackerWatchdogAlert[];
}
