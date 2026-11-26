// @harness-uid u_nyrzsecwoe
import type { TrackerRecurringRepository } from '../../../repositories/projects-sessions/TrackerRecurringRepository';
import type { TrackerBoxJob } from '../../../repositories/projects-sessions/TrackerRecurringRepository.types';
import { trackerIsoTime } from '../../../utils/projects-sessions/normalizeTrackerDue';
import { trackerItemError } from '../../../utils/projects-sessions/trackerItemError';
import type { TrackerBoxJobRunner } from '../TrackerRecurringService.types';
import type { TrackerBoxJobTarget } from './trackerBoxJobAdmin.types';

const wakeModes = ['finding', 'fail', 'always'] as const;

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
function jobSettings(input: Readonly<Record<string, unknown>>, current: TrackerBoxJob | undefined) {
	return {
		cmd: jobCommand(input.cmd ?? current?.cmd),
		wake_on: jobWakeMode(input.wake_on ?? current?.wake_on ?? 'finding'),
		timeout_s: jobTimeout(input.timeout_s ?? current?.timeout_s ?? 120)
	};
}

function jobCommand(value: unknown): string {
	const cmd = String(value ?? '');
	if (!cmd.trim()) throw trackerItemError('a box job needs --cmd', 400);
	return cmd;
}

function jobWakeMode(value: unknown): TrackerBoxJob['wake_on'] {
	const mode = wakeModes.find((candidate) => candidate === value);
	if (!mode) throw trackerItemError('wake-on must be finding, fail or always', 400);
	return mode;
}

function jobTimeout(value: unknown): number {
	const seconds = Number(value);
	if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
		throw trackerItemError('timeout must be 1-3600 seconds', 400);
	return seconds;
}
