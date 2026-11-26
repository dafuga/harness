// @harness-uid u_bl6xl2h4a3
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerLaunchIntent,
	TrackerLaunchRung,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService';
import {
	automaticQuietHour,
	automaticRequestHold
} from '../../agents-providers/tracker-dispatcher-service/launchEligibility';

export function automaticQueueHold(
	item: TrackerDispatchItem | null,
	{
		policy,
		intent,
		now,
		queued
	}: {
		policy?: TrackerDispatchPolicy;
		intent: TrackerLaunchIntent;
		now: number;
		queued?: TrackerLaunchRung;
	}
) {
	if (!item || item.launch?.token !== intent.token) return 'launch request changed or is missing';
	if (!policy) return null;
	const held = automaticRequestHold(item, policy, now);
	if (held) return held;
	if (automaticQuietHour(now)) return 'automatic launch night hold';
	// Admit with the model, so a held provider never takes a fleet slot from another one.
	return policy.admit(item, intent, queued ?? intendedRung(item, intent, policy));
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
