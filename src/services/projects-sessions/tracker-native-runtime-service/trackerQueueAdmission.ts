// @harness-uid u_bl6xl2h4a3
import type { TrackerDispatchRepository } from '../../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { trackerStoredSchedulingHold } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import { dispatchRunRows } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchRunRows';
import type { TrackerDispatchSchedulerOptions } from '../TrackerDispatchSchedulerService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerResourceHoldPrefix } from '../../../utils/projects-sessions/trackerHostResourceHold';
import { trackerTimeZone } from '../../../utils/projects-sessions/normalizeTrackerDue';
import { trackerHostCapacityHold } from './trackerHostAdmission';
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerLaunchIntent,
	TrackerLaunchRung,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService';
import {
	automaticRequestHold,
	canonicalNode,
	continuesStartedRun,
	isDueNow
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';

export function automaticQueueHold(
	item: TrackerDispatchItem | null,
	{
		policy,
		intent,
		now,
		queued,
		runs = []
	}: {
		policy?: TrackerDispatchPolicy;
		intent: TrackerLaunchIntent;
		now: number;
		queued?: TrackerLaunchRung;
		runs?: readonly TrackerRunReceipt[];
	}
) {
	if (!item || item.launch?.token !== intent.token) return 'launch request changed or is missing';
	if (!policy) return null;
	const held = automaticRequestHold(
		item,
		policy,
		now,
		continuesStartedRun(intent.source, runs, policy)
	);
	if (held) return held;
	// Admit with the model, so a held provider never takes a fleet slot from another one.
	return policy.admit(item, intent, queued ?? intendedRung(item, intent, policy));
}

export function automaticHostHold(
	store: TrackerPersistenceService,
	item: TrackerItem,
	run: TrackerRunReceipt,
	{ now, automaticEnabled }: { now: () => number; automaticEnabled?: () => boolean }
) {
	if (run.launch_source === 'manual' && run.attempt <= 1) return false;
	const at = now();
	if (automaticEnabled?.() === false || trackerStoredSchedulingHold(item, at)) return true;
	if (!item.due || isDueNow(item.due, trackerTimeZone, at)) return false;
	if (run.launch_source !== 'recovery') return true;
	const runs = dispatchRunRows(store.database, store.node, item.id);
	return !continuesStartedRun(run.launch_source, runs, { node: store.node });
}

function intendedRung(
	item: TrackerDispatchItem,
	intent: TrackerLaunchIntent,
	policy: TrackerDispatchPolicy
) {
	const pick = intent.scheduledPick ?? policy.pickModel(item);
	return 'error' in pick ? null : pick.rung;
}

export function queuedRung(run: TrackerRunReceipt) {
	const { rung: id, cli, model, effort, pinned } = run;
	return cli === 'none' ? undefined : { id, cli, model, effort, pinned };
}

/** Only the current owner may move a portable request and only before a run exists. */
export function transferHeldTrackerLaunch(
	repository: TrackerDispatchRepository,
	options: TrackerDispatchSchedulerOptions,
	{
		item,
		intent,
		hold
	}: { item: TrackerDispatchItem | null; intent: TrackerLaunchIntent; hold: string }
) {
	const { policy, alternateAdapterHost } = options;
	if (!item || !policy || !isHostPlacementHold(hold)) return undefined;
	const local = canonicalNode(policy.node, policy);
	const alternate = alternateLaunchNode({ policy, alternateAdapterHost, local }, item, intent);
	if (!alternate || canonicalNode(alternate, policy) === local) return undefined;
	const reason = `Automatic launch moved from ${local} to ${alternate} (${hold})`;
	return repository.launches.moveUnclaimedLaunch(item.id, intent.token, alternate, reason)
		? reason
		: undefined;
}

function alternateLaunchNode(
	{
		policy,
		alternateAdapterHost,
		local
	}: {
		policy: TrackerDispatchPolicy;
		alternateAdapterHost: TrackerDispatchSchedulerOptions['alternateAdapterHost'];
		local: string;
	},
	item: TrackerDispatchItem,
	intent: TrackerLaunchIntent
) {
	if (!hasPortableSource(intent.source)) return undefined;
	if (item.adapterDueOwner) return alternateAdapterHost?.(item, item.launch ?? intent);
	return policy.chooseHost(item, { source: intent.source, requestedNode: local }).node;
}

function isHostPlacementHold(hold: string) {
	return hold === trackerHostCapacityHold || hold.startsWith(trackerResourceHoldPrefix);
}

function hasPortableSource(source: TrackerLaunchIntent['source']): source is 'due' | 'automatic' {
	return source === 'due' || source === 'automatic';
}
