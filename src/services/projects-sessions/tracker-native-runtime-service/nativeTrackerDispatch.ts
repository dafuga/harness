// @harness-uid u_bl6xl2h4a3
import { TrackerDispatchRepository } from '../../../repositories/projects-sessions/TrackerDispatchRepository';
import { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';
import { liveTrackerDuePolicy } from './nativeTrackerDuePolicy';

export function composeTrackerDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	if (!options.dispatch) return undefined;
	const { policy: supplied, due, sessions, telemetry: _telemetry, ...scheduler } = options.dispatch;
	const { node, now = Date.now, role } = options;
	const policy = { ...supplied, node, now, hub: role === 'hub' };
	const duePolicy = due && (() => liveTrackerDuePolicy(store, due(), role));
	const repository = new TrackerDispatchRepository(store, {
		policy,
		due: duePolicy,
		sessions,
		now
	});
	const dispatch = new TrackerDispatcherService(repository, policy);
	const grant = scheduler.grant ?? spokeGrant(store, options);
	return {
		dispatch,
		scheduler: new TrackerDispatchSchedulerService(repository, dispatch, {
			...scheduler,
			policy,
			grant
		})
	};
}

function spokeGrant(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	const hub = options.links?.find(({ link }) => (link ?? 'hub') === 'hub');
	if (!hub) return undefined;
	return async (itemId: string, token: string, signal: AbortSignal) => {
		const client = new TrackerSpokeSyncService({
			...hub,
			store,
			transport: (request) => hub.transport(request, signal)
		});
		const allowed = await client.permitDue(itemId, token);
		return {
			token,
			node: store.node,
			decision: allowed ? ('granted' as const) : ('denied' as const)
		};
	};
}
