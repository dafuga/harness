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
		...modelFields(item, pick, previous),
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
	pick: TrackerLaunchPick | { error: string },
	previous?: TrackerRunReceipt
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
		pinned: previous?.pinned ?? Boolean(rung.pinned),
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
		kill_at: undefined,
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
		startup?: boolean;
		reopen?: boolean;
		usage?: TrackerReceiptUsage;
	},
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
): TrackerDispatchDecision {
	const { item } = snapshot;
	const finished = finishRun(run, { ...failure, now });
	// Recovery owns its budget and backoff across separate launch tokens.
	if (run.launch_source === 'recovery') return recordRun(finished);
	if (!item || !matchesRequest(item, run, policy) || unavailableRetry(item, failure.reopen)) {
		return recordRun(finished);
	}
	const reopen = failure.reopen ? { status: 'open' as const } : undefined;
	// A verification rejection may reopen completed work before applying the automatic gate.
	if (automaticRequestHold({ ...item, ...reopen }, policy, now)) return recordRun(finished, reopen);
	const choice = retryRung(item, run, policy, failure.startup);
	if (!choice) return recordRun(finished, giveUp(snapshot, finished, reopen));
	const pick = {
		rung: choice,
		kind: run.kind ?? item.kind,
		reason: `retry after ${run.rung} ${failure.outcome}`
	};
	const retry = queueRun(
		snapshot,
		{ item, token: run.auto_token, pick, previous: run },
		policy,
		now
	);
	return {
		result: { status: 'recorded', run: finished, retry },
		writes: { runs: [finished, retry], ...(reopen && { item: reopen }) }
	};
}

function unavailableRetry(item: TrackerDispatchItem, reopen?: boolean) {
	return inactive(item) && !reopen;
}

function retryRung(
	item: TrackerDispatchItem,
	run: TrackerRunReceipt,
	policy: TrackerDispatchPolicy,
	startup = false
) {
	if (run.attempt > (policy.maxRetries ?? 1) || run.cli === 'none') return null;
	if (!startup) return policy.retryModel(item, run);
	return { id: run.rung, cli: run.cli, model: run.model, effort: run.effort, pinned: run.pinned };
}

function giveUp(
	{ item, runs }: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	reopen?: TrackerDispatchWrites['item']
): TrackerDispatchWrites['item'] {
	if (!item || (item.status === 'done' && !reopen)) return undefined;
	const history = runs
		.filter((attempt) => attempt.auto_token === run.auto_token && attempt.id !== run.id)
		.map(({ rung, outcome }) => `${rung}: ${outcome}`);
	history.push(`${run.rung}: ${run.outcome}`);
	return {
		status: 'blocked',
		awaitingAnswer: true,
		answeredCurrentBlock: false,
		blockedReason: `auto-launch gave up after ${run.attempt} attempt(s) (${history.join(', ')}); last: ${run.failure_reason}`
	};
}
