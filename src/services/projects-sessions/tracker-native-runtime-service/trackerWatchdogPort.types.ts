// @harness-uid u_bl6xl2h4a3
import type { TrackerTmuxNudge } from '../../../adapters/projects-sessions/TrackerTmuxAdapter.types';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

export interface TrackerWatchdogPort {
	scan(signal: AbortSignal): Promise<WatchdogPane[] | null>;
	nudge(
		input: TrackerTmuxNudge & { id: string; itemId: string },
		signal: AbortSignal
	): Promise<boolean>;
	send(alerts: readonly TrackerWatchdogAlert[], signal: AbortSignal): Promise<boolean>;
}
