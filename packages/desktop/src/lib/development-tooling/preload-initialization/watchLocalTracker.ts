// @harness-uid u_saa6wluo2j
import type { TrackerChangeEvent } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { InboxReply } from '../../../models/development-tooling/TrackerInbox.types';
import type { Input } from './initializePreload.types';
import type { LocalTransportClientService } from './LocalTransportClientService';

/** The one read that tells a new window whether the change feed answers. */
export type LocalTrackerRead = (input: Input) => Promise<InboxReply<unknown>>;

/** Pushes from the main process, plus the state at subscribe time unless a push arrived first. */
export function watchLocalTracker(
	transport: Pick<LocalTransportClientService, 'on'>,
	read: LocalTrackerRead,
	listener: (event: TrackerChangeEvent) => void
): () => void {
	let heard = false;
	let stopped = false;
	const stop = transport.on('tracker', (value) => {
		heard = true;
		listener(value as TrackerChangeEvent);
	});
	void read({ operation: 'live' }).then((reply) => {
		if (heard || stopped) return;
		const state = reply.freshness === 'current' ? 'live' : 'reconnecting';
		listener({ state, changed: false });
	});
	return () => {
		stopped = true;
		stop();
	};
}
