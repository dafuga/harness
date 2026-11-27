// @harness-uid u_bl6xl2h4a3
import type {
	TrackerTmuxClose,
	TrackerTmuxNudge
} from '../../../adapters/projects-sessions/TrackerTmuxAdapter.types';
import type { WatchdogCli, WatchdogPane } from '../WatchdogPaneService.types';
import type { TrackerWatchdogAlert } from './trackerHostWatchdog.types';

export interface TrackerWatchdogPort {
	/** Maximum batch size supported by a destination with a bounded composer. */
	batchLimit?: number;
	peers?(signal: AbortSignal): Promise<TrackerWatchdogAlert[] | undefined>;
	close?(input: TrackerTmuxClose, signal: AbortSignal): Promise<boolean>;
	inventory?(signal: AbortSignal): Promise<WatchdogPane[]>;
	scan(signal: AbortSignal): Promise<WatchdogPane[] | null>;
	nudge(
		input: TrackerTmuxNudge & { id: string; itemId: string },
		signal: AbortSignal
	): Promise<boolean>;
	receipts?(
		alerts: readonly TrackerWatchdogAlert[],
		signal: AbortSignal
	): Promise<ReadonlySet<string>>;
	/** True only with proof of delivery. `backlog` says more alerts wait behind this batch. */
	send(
		alerts: readonly TrackerWatchdogAlert[],
		signal: AbortSignal,
		queue?: { backlog: boolean }
	): Promise<boolean>;
	/** Type one message into the named session's idle prompt and confirm it was submitted. */
	deliver?(
		input: {
			session: string;
			message: string;
			expected?: { startedAt: number; cli: WatchdogCli; key?: string };
		},
		signal: AbortSignal
	): Promise<'delivered' | 'busy' | 'missing'>;
}
