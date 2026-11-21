// @harness-uid u_adwgoryfne
import type {
	TrackerRecurringResult,
	TrackerRecurringWork
} from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import {
	trackerIsoTime,
	trackerLocalStamp
} from '../../../utils/projects-sessions/normalizeTrackerDue';
import type { TrackerRecurringJobReceipt } from '../TrackerRecurringService.types';

export function recurringJobOutcome(
	work: Extract<TrackerRecurringWork, { job: unknown }>,
	receipt: TrackerRecurringJobReceipt,
	now: number
) {
	const { job, wake } = work;
	const { code, timedOut } = receipt;
	const finding = code === 10 && !timedOut;
	const failed = timedOut || (code !== 0 && !finding);
	const output = redactOutput(receipt.output.slice(0, 8192)).trim();
	const last =
		output
			.split('\n')
			.filter((line) => line.trim())
			.at(-1)
			?.slice(0, 300) ?? '';
	const summary = timedOut
		? `timed out after ${job.timeout_s}s`
		: finding
			? `finding: ${last}`
			: failed
				? `exit ${code}: ${last}`
				: last || 'ok';
	const result: TrackerRecurringResult = {
		occurrence: trackerIsoTime(wake.at),
		status: failed ? 'failed' : 'done',
		at: trackerIsoTime(now),
		by: 'box-job',
		note: `box job: ${summary}`
	};
	const stamp = trackerLocalStamp(wake.at, String(wake.payload.every_tz));
	const note = `occurrence ${stamp} ${result.status}: ${result.note}`;
	const notify = job.wake_on === 'always' || finding || (failed && job.wake_on === 'fail');
	const payload = {
		...wake.payload,
		box_job: {
			exit_code: timedOut ? null : code,
			timed_out: timedOut,
			status: failed ? 'failed' : finding ? 'finding' : 'ok'
		},
		finding: output.slice(-4000) || null
	};
	return {
		result,
		note,
		wake: notify ? { phase: 'wake' as const, wake: { ...wake, payload } } : undefined
	};
}

function redactOutput(value: string): string {
	return value
		.replace(
			/((?:api[_-]?key|token|secret|password|passwd|authorization|bearer)\s*[:=]\s*)\S+/gi,
			'$1[redacted]'
		)
		.replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, '[redacted]')
		.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[redacted]');
}
