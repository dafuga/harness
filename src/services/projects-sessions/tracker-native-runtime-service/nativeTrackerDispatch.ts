import { chooseTrackerFleetHost } from './composeTrackerFleet';
import type { PeerStarts, TrackerFleetRuntime } from './nativeTrackerDispatch.types';
// @harness-uid u_bl6xl2h4a3
import { ensureTrackerRunSchema } from '../../../repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { adapterFailover } from './trackerAdapterFailover';
import { TrackerDispatchRepository } from '../../../repositories/projects-sessions/TrackerDispatchRepository';
import { trackerTimeZone } from '../../../utils/projects-sessions/normalizeTrackerDue';
import {
	automaticEnabled,
	canonicalNode,
	mayScheduleHere
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
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
import { liveTrackerDuePolicy } from './nativeTrackerDuePolicy';
import { grantsDelegation } from './trackerDueDelegation';
import { spokeAutomaticPermit, spokeGrant } from './trackerHubPermits';

export function composeTrackerDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	fleet?: TrackerFleetRuntime
) {
	if (!options.dispatch) {
		if (options.syncResponder || options.links?.length) ensureTrackerRunSchema(store.database);
		return emptyDispatch(store, options);
	}
	return nativeDispatch(store, { ...options, dispatch: options.dispatch }, fleet);
}

function emptyDispatch(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	return {
		dispatch: undefined,
		scheduler: undefined,
		permitAutomatic: undefined,
		permitDue: undefined,
		duePreview: {
			timeZone: options.timeZone ?? trackerTimeZone,
			due: () => liveTrackerDuePolicy(store, { enabled: false, paused: false }, options.role)
		} satisfies TrackerDuePreviewPolicy
	};
}

function nativeDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions & {
		dispatch: NonNullable<TrackerNativeRuntimeOptions['dispatch']>;
	},
	fleet?: TrackerFleetRuntime
) {
	const { due, sessions, runner, scheduleDue, grant: configuredGrant } = options.dispatch;
	const { now = Date.now, role } = options;
	const policy = nativeDispatchPolicy(options, options.dispatch.policy, fleet);
	const duePolicy = due && (() => liveTrackerDuePolicy(store, due(), role));
	const repository = new TrackerDispatchRepository(store, {
		policy,
		due: duePolicy,
		sessions,
		now
	});
	const dispatch = new TrackerDispatcherService(repository, policy);
	const grant =
		configuredGrant ??
		spokeGrant(store, options, (itemId) => {
			const { item, due: current } = repository.readSnapshot(itemId);
			return Boolean(item && current && mayScheduleHere(item, current, policy));
		});
	const permits = dispatchPermits(repository, {
		store,
		options,
		policy,
		machines: fleet?.machines
	});
	return {
		dispatch,
		permitAutomatic: permits.hubAutomatic,
		permitDue: permits.permitDue,
		duePreview: configuredDuePreview(repository, policy, { duePolicy, scheduleDue }),
		scheduler: new TrackerDispatchSchedulerService(repository, dispatch, {
			runner,
			scheduleDue,
			policy,
			grant,
			permitAutomatic: permits.automatic,
			alternateAdapterHost: role === 'hub' ? adapterFailover(options, now) : undefined
		})
	};
}

function nativeDispatchPolicy(
	options: TrackerNativeRuntimeOptions,
	supplied: NonNullable<TrackerNativeRuntimeOptions['dispatch']>['policy'],
	fleet?: TrackerFleetRuntime
) {
	const { node, now = Date.now, role } = options;
	const policy: TrackerDispatchPolicy = {
		...supplied,
		node,
		now,
		hub: role === 'hub',
		allowDelegatedAdapterDue: role === 'spoke' && Boolean(options.links?.length),
		automaticEnabled: supplied.automaticEnabled ?? options.automaticEnabled
	};
	if (fleet)
		policy.chooseHost = chooseTrackerFleetHost(
			{ ...policy },
			{
				machines: fleet.machines,
				now,
				samples: () => fleet.fleetSamples?.() ?? []
			}
		);
	return policy;
}

function dispatchPermits(
	repository: TrackerDispatchRepository,
	{
		store,
		options,
		policy,
		machines
	}: {
		store: TrackerPersistenceService;
		options: TrackerNativeRuntimeOptions;
		policy: TrackerDispatchPolicy;
		machines?: PeerStarts;
	}
) {
	const localPermit = () =>
		automaticEnabled(policy) && repository.launches.reserveAutomaticSlot(policy.now());
	if (options.role === 'spoke')
		return { automatic: spokeAutomaticPermit(store, options, localPermit) ?? localPermit };
	return {
		automatic: localPermit,
		hubAutomatic: localPermit,
		// A due start also needs a fresh, healthy memory and storage reading from a peer that reports its resources.
		permitDue: (id: string, token: string, target: string) =>
			!machines?.peerStartHold(canonicalNode(target, policy)) &&
			grantsDelegation(repository.readSnapshot(id), { token, target }, policy)
	};
}

function configuredDuePreview(
	repository: TrackerDispatchRepository,
	policy: TrackerDispatchPolicy,
	{ duePolicy, scheduleDue }: { duePolicy?: () => TrackerDuePolicy; scheduleDue?: boolean }
): TrackerDuePreviewPolicy {
	const due = () => {
		const enabled = scheduleDue === true && automaticEnabled(policy);
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
