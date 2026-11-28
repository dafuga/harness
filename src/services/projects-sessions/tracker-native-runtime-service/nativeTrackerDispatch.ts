import type { PeerStarts } from './nativeTrackerDispatch.types';
// @harness-uid u_bl6xl2h4a3
import { trackerRunSchema } from '../../../repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
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
import { recordLaunchStartupFailure } from './trackerHostWatchdogAlerts';

export function composeTrackerDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	machines?: PeerStarts
) {
	if (!options.dispatch) {
		if (options.syncResponder || options.links?.length) store.database.exec(trackerRunSchema);
		return emptyDispatch(store, options);
	}
	return nativeDispatch(store, { ...options, dispatch: options.dispatch }, machines);
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
	machines?: PeerStarts
) {
	const {
		policy: supplied,
		due,
		sessions,
		runner,
		scheduleDue,
		grant: configuredGrant
	} = options.dispatch;
	const { node, now = Date.now, role } = options;
	const policy = {
		...supplied,
		node,
		now,
		hub: role === 'hub',
		allowDelegatedAdapterDue: role === 'spoke' && Boolean(options.links?.length),
		automaticEnabled: supplied.automaticEnabled ?? options.automaticEnabled
	};
	const duePolicy = due && (() => liveTrackerDuePolicy(store, due(), role));
	const repository = new TrackerDispatchRepository(store, {
		policy,
		due: duePolicy,
		sessions,
		now,
		onStartupFailure: (run, at) => recordLaunchStartupFailure(store, run, at)
	});
	const dispatch = new TrackerDispatcherService(repository, policy);
	const grant =
		configuredGrant ??
		spokeGrant(store, options, (itemId) => {
			const { item, due: current } = repository.readSnapshot(itemId);
			return Boolean(item && current && mayScheduleHere(item, current, policy));
		});
	const permits = dispatchPermits(repository, { store, options, policy, machines });
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
		// A due start also needs a fresh, calm reading from a peer that reports its resources.
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
