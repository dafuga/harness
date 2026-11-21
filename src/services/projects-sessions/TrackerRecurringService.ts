// @harness-uid u_adwgoryfne
import type { TrackerRecurringRepository } from '../../repositories/projects-sessions/TrackerRecurringRepository';
import type { TrackerRecurringWork } from '../../repositories/projects-sessions/TrackerRecurringRepository.types';
import { trackerIsoTime } from '../../utils/projects-sessions/normalizeTrackerDue';
import type { TrackerRecurringOptions } from './TrackerRecurringService.types';
import { planRecurringOccurrence } from './tracker-recurring-service/planRecurringOccurrence';
import { recurringJobOutcome } from './tracker-recurring-service/recurringJobOutcome';

/** Advances hub schedules and replays durable wakes and injected job receipts. */
export class TrackerRecurringService {
	private ticking = false;

	constructor(
		private readonly repository: TrackerRecurringRepository,
		private readonly options: TrackerRecurringOptions
	) {}

	async tick(signal: AbortSignal): Promise<void> {
		if (signal.aborted || this.ticking) return;
		this.ticking = true;
		try {
			await this.processSchedules(signal);
		} finally {
			this.ticking = false;
		}
	}

	private async processSchedules(signal: AbortSignal) {
		const now = this.options.now();
		const errors: unknown[] = [];
		for (const id of this.repository.activeItemIds()) {
			try {
				this.repository.advance(id, now, (item, spec) => planRecurringOccurrence(item, now, spec));
			} catch (error) {
				errors.push(error);
			}
		}
		for (const work of this.repository.work()) {
			signal.throwIfAborted();
			try {
				await this.processWork(work, signal);
			} catch (error) {
				errors.push(error);
			}
		}
		if (errors.length > 1) throw new AggregateError(errors, 'Tracker recurring work failed');
		if (errors.length) throw errors[0];
	}

	private async processWork(work: TrackerRecurringWork, signal: AbortSignal) {
		if (work.phase === 'wake') {
			this.options.enqueue(work.wake);
			this.repository.settle(work);
			return;
		}
		const { jobs } = this.options;
		if (!jobs) return;
		const { job, wake } = work;
		const request = { ...job, key: wake.key, occurrence: trackerIsoTime(wake.at) };
		const receipt =
			work.phase === 'queued'
				? this.repository.claim(work) && (await jobs.start(request, signal))
				: await jobs.observe(request, signal);
		if (!receipt) return;
		const outcome = recurringJobOutcome(work, receipt, this.options.now());
		const pendingWake = this.repository.settle({ ...work, phase: 'claimed' }, outcome);
		if (pendingWake && outcome.wake && !signal.aborted) {
			this.options.enqueue(outcome.wake.wake);
			this.repository.settle(outcome.wake);
		}
	}
}
