// @harness-uid u_saa6wluo2j
import type { TrackerChangeEvent } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { LocalTransportClientService } from './LocalTransportClientService';
import type { LocalTrackerRead } from './watchLocalTracker.types';
export type { LocalTrackerRead } from './watchLocalTracker.types';

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
