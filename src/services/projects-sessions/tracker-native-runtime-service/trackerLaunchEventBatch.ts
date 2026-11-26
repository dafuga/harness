// @harness-uid u_bl6xl2h4a3
import {
	markLaunchEventsBatched,
	pendingLaunchEvents
} from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchLaunchEvents';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';

const batchWindow = 10 * 60_000;

/**
 * Hand launch events to the notification outbox as one summary, ten minutes after the oldest.
 * Like the legacy dispatcher, a node without a webhook sender still settles its events.
 */
export function batchTrackerLaunchEvents(runtime: TrackerNativeRuntimeService): void {
	const { store, scheduler, notifications, now } = runtime;
	if (!scheduler) return;
	const pending = pendingLaunchEvents(store.database);
	if (!pending.length || now() - pending[0].at < batchWindow) return;
	const lastId = pending[pending.length - 1].id;
	// The key repeats after an interrupted batch, so the outbox keeps one copy.
	notifications?.enqueue({
		kind: 'autolaunch',
		key: `autolaunch|${pending[0].id}-${lastId}`,
		payload: {
			title: `Auto-launch: ${pending.length} update${pending.length === 1 ? '' : 's'}`,
			events: pending.map(({ at, kind, item_id, run_id, text }) => ({
				at: new Date(at).toISOString(),
				kind,
				item_id,
				run_id,
				text
			}))
		}
	});
	markLaunchEventsBatched(store.database, lastId);
}
