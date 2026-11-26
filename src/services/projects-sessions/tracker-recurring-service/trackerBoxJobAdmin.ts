// @harness-uid u_nyrzsecwoe
import type { TrackerRecurringRepository } from '../../../repositories/projects-sessions/TrackerRecurringRepository';
import type { TrackerRecurringJob } from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import { trackerIsoTime } from '../../../utils/projects-sessions/normalizeTrackerDue';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerBoxJobRunner } from '../TrackerRecurringService.types';
import type { TrackerBoxJobTarget } from './trackerBoxJobAdmin.types';

const wakeModes: readonly string[] = ['finding', 'fail', 'always'];

/** The `tracker job` commands over the hub's local job table. */
export function trackerBoxJobAdmin(
	repository: TrackerRecurringRepository,
	runner: TrackerBoxJobRunner,
	now: () => number
) {
	const existing = (id: string) => {
		const job = repository.boxJobs.read(id);
		if (!job) throw trackerItemError('that item has no box job', 404);
		return job;
	};
	return {
		list: () =>
			repository.boxJobs.list().map((job) => ({ ...job, running: runner.running(job.item_id) })),
		set({ id, every }: TrackerBoxJobTarget, input: Readonly<Record<string, unknown>>) {
			if (!every)
				throw trackerItemError(
					'a box job needs a recurring item (tracker update <id> --every ...)',
					400
				);
			repository.boxJobs.write({
				item_id: id,
				...jobSettings(input, repository.boxJobs.read(id)),
				updated_at: now()
			});
			return existing(id);
		},
		remove({ id }: TrackerBoxJobTarget) {
			if (!repository.boxJobs.remove(id)) throw trackerItemError('that item has no box job', 404);
			return { removed: id };
		},
		/** Records nothing and wakes nobody. */
		async test({ id, occurrence }: TrackerBoxJobTarget, signal: AbortSignal) {
			const job = existing(id);
			if (runner.running(id)) throw trackerItemError('that job is running right now', 409);
			const receipt = await runner.test(
				{ ...job, occurrence: occurrence ?? trackerIsoTime(now()) },
				signal
			);
			return {
				item_id: id,
				exit_code: receipt.code,
				timed_out: receipt.timedOut,
				finding: !receipt.timedOut && receipt.code === 10,
				output: receipt.output
			};
		}
	};
}

/** Omitted settings keep the stored job's values. */
function jobSettings(
	input: Readonly<Record<string, unknown>>,
	current: (TrackerRecurringJob & { cmd: string }) | undefined
) {
	const cmd = String(input.cmd ?? current?.cmd ?? '');
	if (!cmd.trim()) throw trackerItemError('a box job needs --cmd', 400);
	const wake = String(input.wake_on ?? current?.wake_on ?? 'finding');
	if (!wakeModes.includes(wake))
		throw trackerItemError('wake-on must be finding, fail or always', 400);
	const timeout = Number(input.timeout_s ?? current?.timeout_s ?? 120);
	if (!Number.isInteger(timeout) || timeout < 1 || timeout > 3600)
		throw trackerItemError('timeout must be 1-3600 seconds', 400);
	return { cmd, wake_on: wake as TrackerRecurringJob['wake_on'], timeout_s: timeout };
}
