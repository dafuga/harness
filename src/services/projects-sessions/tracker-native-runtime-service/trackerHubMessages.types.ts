// @harness-uid u_bl6xl2h4a3
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerWatchdogPort } from './trackerWatchdogPort.types';

export interface HubMessageDelivery {
	store: TrackerPersistenceService;
	driver: TrackerWatchdogPort;
	now?: () => number;
}

export type LocalRun = {
	item_id: string;
	state: string;
	ended_at: number | null;
	tmux: string | null;
};
