// @harness-uid u_nawtixuqir
import type {
	TrackerBoxJob,
	TrackerListedBoxJob
} from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import type {
	NativeTrackerJobResponse,
	NativeTrackerJobTest
} from './formatNativeTrackerJob.types';

export function formatNativeTrackerJob(
	mode: string | undefined,
	data: NativeTrackerJobResponse
): string {
	switch (mode) {
		case 'list':
			return (data as TrackerListedBoxJob[]).map(listedJob).join('\n') || '(no box jobs)';
		case 'set': {
			const { item_id, wake_on, timeout_s } = data as TrackerBoxJob;
			return `box job set on [${item_id.slice(0, 6)}]: wake on ${wake_on}, timeout ${timeout_s}s`;
		}
		case 'rm':
			return `box job removed from [${(data as { removed: string }).removed.slice(0, 6)}]`;
		default:
			return testedJob(data as NativeTrackerJobTest);
	}
}

function listedJob(job: TrackerListedBoxJob): string {
	const { item_id, title, every, wake_on, timeout_s, running, cmd } = job;
	const state = running ? ' | RUNNING' : '';
	const settings = `every ${every} | wake on ${wake_on} | timeout ${timeout_s}s${state}`;
	return `[${item_id.slice(0, 6)}] ${title}  (${settings})\n    ${cmd}`;
}

function testedJob({ exit_code, timed_out, finding, output }: NativeTrackerJobTest): string {
	const note = finding ? ' (finding: would wake the owner)' : '';
	const outcome = timed_out ? 'timed out' : `exit ${exit_code}${note}`;
	return `${outcome}\n${output.trimEnd()}`;
}
