// @harness-uid u_bl6xl2h4a3
import type {
	TrackerDispatchSnapshot,
	TrackerDispatchPolicy,
	TrackerLaunchIntent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService';
import { automaticRequestHold } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import {
	pickLaunchModel,
	pickQueuedRetryModel
} from '../../agents-providers/tracker-dispatcher-service/runGiveUp';

export function automaticQueueHold(
	snapshot: TrackerDispatchSnapshot,
	{
		policy,
		intent,
		now,
		queued
	}: {
		policy?: TrackerDispatchPolicy;
		intent: TrackerLaunchIntent;
		now: number;
		queued?: TrackerRunReceipt;
	}
) {
	const { item, runs } = snapshot;
	if (!item || item.launch?.token !== intent.token) return 'launch request changed or is missing';
	if (!policy) return null;
	const held = automaticRequestHold(item, policy, now);
	if (held) return held;
	// Admit with the model, so a held provider never takes a fleet slot from another one.
	const pick = queued
		? pickQueuedRetryModel(item, queued, runs, policy)
		: pickLaunchModel(item, policy);
	return policy.admit(item, intent, 'error' in pick ? null : pick.rung);
}
