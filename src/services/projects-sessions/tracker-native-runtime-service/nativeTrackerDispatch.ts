// @harness-uid u_bl6xl2h4a3
import { TrackerDispatchRepository } from '../../../repositories/projects-sessions/TrackerDispatchRepository';
import { trackerTimeZone } from '../../../utils/projects-sessions/normalizeTrackerDue';
import { previewDueLaunch } from '../../agents-providers/tracker-dispatcher-service/launchIntent';
import { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import type {
	TrackerDispatchPolicy,
	TrackerDuePolicy
} from '../../agents-providers/TrackerDispatcherService.types';
import { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type {
	TrackerDuePreviewPolicy,
	TrackerNativeRuntimeOptions
} from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';
import { liveTrackerDuePolicy } from './nativeTrackerDuePolicy';

export function composeTrackerDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	if (!options.dispatch)
		return {
			dispatch: undefined,
			scheduler: undefined,
			duePreview: {
				timeZone: options.timeZone ?? trackerTimeZone,
				due: () => liveTrackerDuePolicy(store, { enabled: false, paused: false }, options.role)
			} satisfies TrackerDuePreviewPolicy
		};
	const {
		policy: supplied,
		due,
		sessions,
		runner,
		scheduleDue,
		grant: configuredGrant
	} = options.dispatch;
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
	const grant = configuredGrant ?? spokeGrant(store, options);
	return {
		dispatch,
		duePreview: configuredDuePreview(repository, policy, { duePolicy, scheduleDue }),
		scheduler: new TrackerDispatchSchedulerService(repository, dispatch, {
			runner,
			scheduleDue,
			policy,
			grant
		})
	};
}

function configuredDuePreview(
	repository: TrackerDispatchRepository,
	policy: TrackerDispatchPolicy,
	{ duePolicy, scheduleDue }: { duePolicy?: () => TrackerDuePolicy; scheduleDue?: boolean }
): TrackerDuePreviewPolicy {
	const enabled = scheduleDue === true && policy.enabled !== false;
	const due = () => {
		const current = duePolicy?.();
		return {
			...current,
			enabled: enabled && current?.enabled === true,
			adapterDue: enabled && current?.adapterDue === true,
			paused: current?.paused ?? false
		};
	};
	return {
		timeZone: policy.timezone,
		due,
		preview: (id) =>
			previewDueLaunch({ ...repository.readSnapshot(id), due: due() }, policy, policy.now())
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
