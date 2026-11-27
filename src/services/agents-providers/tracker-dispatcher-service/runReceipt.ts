// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchDecision,
	TrackerDispatchItem,
	TrackerDispatchOutcome,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDispatchWrites,
	TrackerLaunchPick,
	TrackerReceiptUsage,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import {
	automaticRequestHold,
	canonicalNode,
	inactive,
	matchesRequest,
	minute
} from './launchEligibility';
import { giveUp, pickRetryModel } from './runGiveUp';

export function etaFor(
	item: TrackerDispatchItem | null,
	policy: TrackerDispatchPolicy,
	now: number
) {
	const due = item?.due;
	const datetime = due && due.length > 10 ? Date.parse(due) : NaN;
	return datetime > now + 15 * minute ? datetime : now + (policy.defaultEtaMinutes ?? 120) * minute;
}

export function queueRun(
	snapshot: TrackerDispatchSnapshot,
	input: {
		item: TrackerDispatchItem;
		token: string;
		pick: TrackerLaunchPick | { error: string };
		previous?: TrackerRunReceipt;
	},
	policy: TrackerDispatchPolicy,
	now: number
): TrackerRunReceipt {
	const { item, token, pick, previous } = input;
	return {
		node: canonicalNode(policy.node, policy),
		id: snapshot.nextRunId,
		item_id: item.id,
		auto_token: token,
		launch_source: item.launch!.source,
		attempt: (previous?.attempt ?? 0) + 1,
		escalated_from: previous?.id ?? null,
		...modelFields(item, pick),
		state: 'queued',
		outcome: null,
		failure_reason: null,
		queued_at: now,
		started_at: null,
		ended_at: null,
		eta_at: null,
		revision: 0
	};
}

export function modelFields(
	item: TrackerDispatchItem,
	pick: TrackerLaunchPick | { error: string }
) {
	const project = item.project ?? item.agent ?? null;
	if ('error' in pick)
		return {
			rung: 'none',
			cli: 'none' as const,
			model: item.model ?? 'unknown',
			effort: null,
			pinned: false,
			kind: item.kind,
			project,
			reason: null
		};
	const { rung } = pick;
	return {
		rung: rung.id,
		cli: rung.cli,
		model: rung.model,
		effort: rung.effort ?? null,
		pinned: Boolean(rung.pinned),
		kind: pick.kind,
		project,
		reason: pick.reason
	};
}
export function reviseRun(
	run: TrackerRunReceipt,
	patch: Partial<TrackerRunReceipt>
): TrackerRunReceipt {
	return { ...run, ...patch, revision: run.revision + 1 };
}

export function recordRun(
	run: TrackerRunReceipt,
	item?: TrackerDispatchWrites['item']
): TrackerDispatchDecision {
	return { result: { status: 'recorded', run }, writes: { runs: [run], ...(item && { item }) } };
}

export function finishRun(
	run: TrackerRunReceipt,
	{
		outcome,
		reason,
		now,
		exitCode,
		usage
	}: {
		outcome: TrackerDispatchOutcome;
		reason: string | null;
		now: number;
		exitCode?: number | null;
		usage?: TrackerReceiptUsage;
	}
) {
	return reviseRun(run, {
		...receiptUsage(usage),
		state: 'finished',
		outcome,
		failure_reason: reason,
		ended_at: now,
		...(exitCode != null && { exit_code: exitCode })
	});
}
function receiptUsage(usage: TrackerReceiptUsage = {}) {
	const fields = [
		'input_tokens',
		'output_tokens',
		'cache_read_tokens',
		'cache_write_tokens',
		'cost_usd',
		'credits_balance'
	] as const;
	return Object.fromEntries(
		fields.filter((key) => usage[key] !== undefined).map((key) => [key, usage[key]])
	);
}

export function failRun(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	failure: {
		outcome: 'failed' | 'rejected' | 'timed_out' | 'abandoned';
		reason: string;
		exitCode?: number | null;
		reopen?: boolean;
		note?: string;
		usage?: TrackerReceiptUsage;
	},
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	const { item } = snapshot;
	const finished = finishRun(run, { ...failure, now });
	// A failed verification or rejection reopens completed work, whether or not a retry follows.
	const reopen = failure.reopen ? { status: 'open' as const, appendNote: failure.note } : undefined;
	// Recovery owns its budget and backoff across separate launch tokens.
	if (
		run.launch_source === 'recovery' ||
		!item ||
		!matchesRequest(item, run, policy) ||
		unavailableRetry(item, failure.reopen) ||
		automaticRequestHold({ ...item, ...reopen }, policy, now)
	)
		return recordFailedRun(finished, reopen);
	return retryFailedRun(snapshot, { item, finished, reopen }, { policy, now });
}

function retryFailedRun(
	snapshot: TrackerDispatchSnapshot,
	{
		item,
		finished,
		reopen
	}: {
		item: TrackerDispatchItem;
		finished: TrackerRunReceipt;
		reopen?: TrackerDispatchWrites['item'];
	},
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	if (finished.attempt > (policy.maxRetries ?? 1) || finished.cli === 'none')
		return recordFailedRun(finished, giveUp(snapshot, finished, reopen));
	const pick = pickRetryModel(item, finished, policy);
	if ('error' in pick)
		return recordFailedRun(finished, giveUp(snapshot, finished, reopen, pick.error));
	const retry = queueRun(
		snapshot,
		{ item, token: finished.auto_token, pick, previous: finished },
		policy,
		now
	);
	return {
		result: { status: 'recorded', run: finished, retry },
		writes: { runs: [finished, retry], failedRunId: finished.id, ...(reopen && { item: reopen }) }
	};
}

function recordFailedRun(run: TrackerRunReceipt, item?: TrackerDispatchWrites['item']) {
	const { result, writes } = recordRun(run, item);
	return { result, writes: { ...writes, failedRunId: run.id } };
}

function unavailableRetry(item: TrackerDispatchItem, reopen?: boolean) {
	return inactive(item) && !reopen;
}
