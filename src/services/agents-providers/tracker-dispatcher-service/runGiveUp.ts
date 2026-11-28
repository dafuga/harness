// @harness-uid u_rzpjc6wqqy
import type {
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchSnapshot,
	TrackerDispatchWrites,
	TrackerRunReceipt
} from '../TrackerDispatcherService.types';
import { automaticRequestHold, schedulingHold, startable } from './launchEligibility';

export function retryHeld(
	item: TrackerDispatchItem,
	run: TrackerRunReceipt,
	startup: boolean | undefined,
	{ policy, now }: { policy: TrackerDispatchPolicy; now: number }
) {
	// Recovery owns its budget and backoff across separate launch tokens.
	if (run.launch_source === 'recovery') return true;
	if (startup && run.launch_source === 'manual')
		return !startable(item) || Boolean(schedulingHold({ ...item, scheduleOff: false }, now));
	return Boolean(automaticRequestHold(item, policy, now));
}

export function retryRung(
	item: TrackerDispatchItem,
	run: TrackerRunReceipt,
	policy: TrackerDispatchPolicy,
	startup = false
) {
	if (run.attempt > (policy.maxRetries ?? 1) || run.cli === 'none') return null;
	if (!startup) return policy.retryModel(item, run);
	if (run.attempt > 1) return null;
	return { id: run.rung, cli: run.cli, model: run.model, effort: run.effort, pinned: run.pinned };
}

export function giveUp(
	snapshot: TrackerDispatchSnapshot,
	run: TrackerRunReceipt,
	reopen?: TrackerDispatchWrites['item']
): TrackerDispatchWrites['item'] {
	const { item, runs } = snapshot;
	if (!item || (item.status === 'done' && !reopen)) return undefined;
	const history = runs
		.filter((attempt) => attempt.auto_token === run.auto_token && attempt.id !== run.id)
		.map(({ rung, outcome }) => `${rung}: ${outcome}`);
	history.push(`${run.rung}: ${run.outcome}`);
	const reason = `auto-launch gave up after ${run.attempt} attempt(s) (${history.join(', ')}); last: ${run.failure_reason}`;
	return {
		...reopen,
		status: 'blocked',
		awaitingAnswer: true,
		answeredCurrentBlock: false,
		blockedReason: reason,
		question: `Blocked: ${reason}`,
		appendNote: [reopen?.appendNote, `blocked: ${reason}`].filter(Boolean).join('\n')
	};
}
