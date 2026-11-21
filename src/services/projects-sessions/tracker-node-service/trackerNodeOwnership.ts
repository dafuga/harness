// @harness-uid u_gvqtr5mdwv
import type { TrackerNodeOwnership } from '../TrackerNodeService.types';

export function trackerNodeOwnership(release: () => void): TrackerNodeOwnership {
	const controller = new AbortController();
	let closing: Promise<void> | undefined;
	const state: TrackerNodeOwnership = {
		lifetime: controller.signal,
		listeners: [],
		close(checkRollback) {
			controller.abort();
			return (closing ??= drainTrackerNode(state, release, checkRollback));
		}
	};
	return state;
}

async function drainTrackerNode(
	state: TrackerNodeOwnership,
	release: () => void,
	checkRollback: boolean
): Promise<void> {
	try {
		const results = await Promise.allSettled([
			...state.listeners.map((listener) => listener.close()),
			state.workers
		]);
		const failed = results.find((result) => result.status === 'rejected');
		if (failed?.status === 'rejected') throw failed.reason;
		if (checkRollback) state.supervisor?.assertLegacyRollbackSafe();
	} finally {
		try {
			state.database?.close();
		} finally {
			try {
				release();
			} finally {
				await state.releaseSocket?.();
			}
		}
	}
}
