// @harness-uid u_bl6xl2h4a3
import { readPendingTrackerQuestion } from '../../../repositories/projects-sessions/tracker-operation-repository/readPendingTrackerQuestion';
import { isTrackerAwaitingAnswer } from '../../../utils/projects-sessions/isTrackerAwaitingAnswer';
import { randomUUID } from 'node:crypto';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import { trackerFlagBlocksRecovery } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchResult,
	TrackerLaunchRung
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { trackerHostCapacityHold } from './trackerHostAdmission';
import { trackerHandoffHold } from './trackerHandoffHold';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { recoveryPollInterval, sessionHealthInterval } from './trackerSessionHealth';
import type { TrackerWatchdogLaunch } from './trackerSessionHealth.types';
import type { TrackerRecoveryState } from './trackerSessionRecovery.types';
import {
	emptyRecoveryState,
	hostWait,
	maxRecoveryAttempts,
	recoveryBudget,
	recoveryRung
} from './trackerRecoveryHistory';

export async function recoverTrackerSession(
	store: TrackerPersistenceService,
	input: { item: TrackerItem; launch: TrackerWatchdogLaunch; now: number }
): Promise<string | null> {
	const { item, launch, now } = input;
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const history = runs.list({ itemId: item.id });
	const latest = history.filter(({ node }) => node === store.node).at(-1);
	const key = `tracker_session_recovery:${item.id}`;
	const state = recoveryBudget(store, { key, latest, item });
	const held = waitForRecoveryProvider(store, latest, state, { item, key, now });
	if (held) return held;
	if (state.token) return checkRecovery(store, { item, key, state, latest }, now);
	if (now < state.retryAt) return null;
	const rung = recoveryRung(latest, item, store.node);
	if (latest && latest.cli !== 'none' && !rung)
		return flagRecovery(
			store,
			{ item, key, state },
			now,
			'The prior session has no verified model.'
		);
	return submitRecovery(store, { item, key, state, launch }, { now, rung });
}

function waitForRecoveryProvider(
	store: TrackerPersistenceService,
	latest: TrackerListedRun | undefined,
	state: TrackerRecoveryState,
	{ item, key, now }: { item: TrackerItem; key: string; now: number }
) {
	if (!latest || latest.auto_token === state.token) return null;
	if (!state.token && item.status !== 'in_progress') return null;
	const held = trackerHandoffHold(store, { item, run: latest, now });
	if (!held) return null;
	if (state.token) saveRecovery(store, key, { ...state, requestedAt: now });
	return `Tracker relaunch is waiting: ${held}.`;
}

async function submitRecovery(
	store: TrackerPersistenceService,
	{
		item,
		key,
		state,
		launch
	}: { item: TrackerItem; key: string; state: TrackerRecoveryState; launch: TrackerWatchdogLaunch },
	{ now, rung }: { now: number; rung?: TrackerLaunchRung }
) {
	const pending = { ...state, token: randomUUID(), requestedAt: now };
	saveRecovery(store, key, pending);
	const result = await launch(item, { token: pending.token, rung }).catch(() => undefined);
	if (result?.status === 'requested' || result?.status === 'existing')
		return `Tracker requested relaunch ${state.failures.length + 1}/${maxRecoveryAttempts} on ${store.node}${rung ? ` using ${rung.model}` : ''}.`;
	return rejectRecoverySubmission(store, { item, key, state }, now, result);
}

function rejectRecoverySubmission(
	store: TrackerPersistenceService,
	{ item, key, state }: { item: TrackerItem; key: string; state: TrackerRecoveryState },
	now: number,
	result?: TrackerDispatchResult
) {
	if (recoveryRequestChanged(result)) {
		saveRecovery(store, key, state);
		return null;
	}
	const reason =
		result && 'reason' in result ? result.reason : 'Tracker could not submit the launch request.';
	if (hostWait(reason)) {
		saveRecovery(store, key, state);
		return reason === trackerHostCapacityHold
			? 'Tracker is waiting for a free host session slot.'
			: `Tracker is waiting for host resources. ${reason}.`;
	}
	if (
		/^(?:no approved Tracker repository or platform|no supported Tracker provider|Tracker model cannot be selected|(?:automatic )?launcher disabled)/.test(
			reason
		)
	)
		return flagRecovery(store, { item, key, state }, now, reason);
	return recordFailure(store, { item, key, state: { ...state, requestedAt: now } }, now, reason);
}

function recoveryRequestChanged(result?: TrackerDispatchResult) {
	if (result?.status === 'conflict' || result?.status === 'ignored') return true;
	return (
		result?.status === 'held' && result.reason === 'item or session state changed during recovery'
	);
}

function checkRecovery(
	store: TrackerPersistenceService,
	{
		item,
		key,
		state,
		latest
	}: { item: TrackerItem; key: string; state: TrackerRecoveryState; latest?: TrackerListedRun },
	now: number
) {
	if (latest?.auto_token === state.token) {
		if (latest.state !== 'finished') return null;
		const evidence = `run #${latest.id} ${latest.outcome ?? 'ended'}${latest.failure_reason ? ` (${latest.failure_reason})` : ''}`;
		return recordFailure(store, { item, key, state }, now, evidence);
	}
	if (now - state.requestedAt < sessionHealthInterval) return null;
	if (item.auto === state.token) {
		const run = new TrackerRunReadRepository(store.database, store.node)
			.list({ itemId: item.id })
			.find(({ auto_token }) => auto_token === state.token);
		if (run) return null;
		store.appendLocal({
			itemId: item.id,
			fields: { auto: null, launch_target: null, launch_source: null, launch_pick: null }
		});
		item = { ...item, auto: null };
	}
	return recordFailure(store, { item, key, state }, now, 'no run appeared within 10 minutes');
}

function recordFailure(
	store: TrackerPersistenceService,
	context: { item: TrackerItem; key: string; state: TrackerRecoveryState },
	now: number,
	reason: string
) {
	const failures = [...context.state.failures, reason];
	const state = {
		...context.state,
		token: null,
		lastToken: context.state.token ?? context.state.lastToken,
		failures,
		retryAt: now + recoveryPollInterval * 2 ** (failures.length - 1)
	};
	if (failures.length >= maxRecoveryAttempts)
		return flagRecovery(
			store,
			{ ...context, state },
			now,
			`${maxRecoveryAttempts} relaunch attempts failed. ${failures.join('; ')}.`
		);
	saveRecovery(store, context.key, state);
	return `Relaunch ${failures.length}/${maxRecoveryAttempts} failed: ${reason}. Tracker will retry.`;
}

export function flagRecoveryError(
	store: TrackerPersistenceService,
	item: TrackerItem,
	now: number,
	detail: string
) {
	const key = `tracker_session_recovery:${item.id}`;
	const state = JSON.parse(store.getMeta(key) ?? 'null') as TrackerRecoveryState | null;
	return flagRecovery(store, { item, key, state: state ?? emptyRecoveryState }, now, detail);
}

function flagRecovery(
	store: TrackerPersistenceService,
	{ item, key, state }: { item: TrackerItem; key: string; state: TrackerRecoveryState },
	now: number,
	detail: string
): null {
	const current = new TrackerItemReadRepository(store.database, () => now).getStored(item.id);
	if (
		current.deleted ||
		(current.status !== 'in_progress' &&
			!(current.status === 'open' && current.launch_source === 'recovery')) ||
		current.auto !== item.auto ||
		(isTrackerAwaitingAnswer(current) &&
			trackerFlagBlocksRecovery(
				current.question ?? readPendingTrackerQuestion(store.database, current.id)
			))
	)
		return null;
	const reason = `Tracker recovery: ${detail}`;
	recordWatchdogAlert(
		store,
		{
			itemId: item.id,
			kind: 'recovery-failed',
			reason,
			identity: `${key}:${now}`,
			persist: () => saveRecovery(store, key, { ...state, token: null })
		},
		now,
		`${reason} On ${store.node}, Chief of Staff should inspect the launcher and unblock the item when retry is safe.`
	);
	return null;
}

function saveRecovery(store: TrackerPersistenceService, key: string, state: TrackerRecoveryState) {
	store.writeMeta({ [key]: JSON.stringify(state) });
}
