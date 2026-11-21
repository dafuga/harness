// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import type { TrackerDuePolicy } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerWireValue } from '../TrackerHubSyncService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const peerPolicy = z.object({
	paused: z.boolean(),
	local_due: z.boolean().optional(),
	at: z.number()
});
const metaKey = 'due_scheduler_policy';

export function liveTrackerDuePolicy(
	store: TrackerPersistenceService,
	policy: TrackerDuePolicy,
	role: 'hub' | 'spoke'
): TrackerDuePolicy {
	if (role === 'hub')
		return { ...policy, paused: policy.paused || store.getMeta('due_scheduler_paused') === '1' };
	const remote = readPolicy(store);
	return {
		...policy,
		paused: policy.paused || remote?.paused === true,
		hubAllowsLocal: policy.hubAllowsLocal !== false && remote?.local_due !== false
	};
}

export function observeTrackerDuePolicy(
	store: TrackerPersistenceService,
	snapshot: TrackerWireValue
): void {
	const incoming = peerPolicy.safeParse(snapshot);
	if (!incoming.success || incoming.data.at <= (readPolicy(store)?.at ?? -1)) return;
	store.writeMeta({ [metaKey]: JSON.stringify(incoming.data) });
}

function readPolicy(store: TrackerPersistenceService) {
	const value = store.getMeta(metaKey);
	return value ? peerPolicy.parse(JSON.parse(value)) : undefined;
}
