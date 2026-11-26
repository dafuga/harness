// @harness-uid u_fqznsayuoe
import type { TrackerChangeEvent } from '$reports/lib/projects-sessions/realtime/realtime.types';
import type { RemoteNativePlugin } from '../../../models/development-tooling/Environment.types';

/**
 * Pushes from the native replica, plus the state at subscribe time unless a push arrived first.
 * The state is asked only once the listener is registered, so nothing can pass between the two.
 */
export function watchPhoneTracker(
	plugin: RemoteNativePlugin,
	listener: (event: TrackerChangeEvent) => void
): () => void {
	let heard = false;
	let stopped = false;
	const subscription = plugin.addListener('tracker', (event) => {
		heard = true;
		if (!stopped) listener(event);
	});
	void subscription
		.then(() => plugin.trackerPush?.())
		.then((reply) => {
			if (reply && !heard && !stopped) listener({ state: reply.state, changed: false });
		})
		// Without an answer the screen keeps reading on demand and claims no link state.
		.catch(() => undefined);
	return () => {
		stopped = true;
		void subscription.then((handle) => handle.remove()).catch(() => undefined);
	};
}
