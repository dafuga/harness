// @harness-uid u_adwgoryfne
import type {
	TrackerRecurringResult,
	TrackerClaimedJob
} from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import {
	trackerIsoTime,
	trackerLocalStamp
} from '../../../utils/projects-sessions/normalizeTrackerDue';
import { redactTrackerJobOutput } from '../../../utils/projects-sessions/redactTrackerJobOutput';
import type { TrackerRecurringJobReceipt } from '../TrackerRecurringService.types';

export function recurringJobOutcome(
	work: TrackerClaimedJob,
	receipt: TrackerRecurringJobReceipt,
	now: number
) {
	const { job, wake } = work;
	const status = jobStatus(receipt);
	const failed = status === 'failed';
	const finding = status === 'finding';
	const output = redactTrackerJobOutput(receipt.output.slice(0, 8192)).trim();
	const last =
		output
			.split('\n')
			.filter((line) => line.trim())
			.at(-1)
			?.slice(0, 300) ?? '';
	const summary = summarizeJob(receipt, status, job.timeout_s, last);
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
			exit_code: receipt.timedOut ? null : receipt.code,
			timed_out: receipt.timedOut,
			status
		},
		finding: output.slice(-4000) || null
	};
	return {
		result,
		note,
		wake: notify ? { phase: 'wake' as const, wake: { ...wake, payload } } : undefined
	};
}

function jobStatus({ code, timedOut }: TrackerRecurringJobReceipt): 'failed' | 'finding' | 'ok' {
	if (timedOut) return 'failed';
	if (code === 10) return 'finding';
	return code === 0 ? 'ok' : 'failed';
}

function summarizeJob(
	{ code, timedOut }: TrackerRecurringJobReceipt,
	status: ReturnType<typeof jobStatus>,
	timeoutSeconds: number,
	last: string
): string {
	if (timedOut) return `timed out after ${timeoutSeconds}s`;
	if (status === 'finding') return `finding: ${last}`;
	if (status === 'failed') return `exit ${code}: ${last}`;
	return last || 'ok';
}
