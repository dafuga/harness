import type { TrackerNativeRuntimeService } from '../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { queueIdleWork } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchLaunchRequests';

export async function sweepIdleWork(
	runtime: TrackerNativeRuntimeService,
	id: string,
	signal: AbortSignal
) {
	const items = new TrackerItemReadRepository(runtime.store.database, runtime.now);
	await queueIdleWork(
		runtime.store,
		{
			rows: items.list({ status: 'all', limit: -1 }),
			snapshot: { host: runtime.store.node, now: runtime.now(), panes: [], items: [], runs: [] },
			dispatch: runtime.dispatch!,
			minutes: 120
		},
		signal
	);
	return items.getStored(id).auto;
}
