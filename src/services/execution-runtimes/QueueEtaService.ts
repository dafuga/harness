// @harness-uid u_zqftrauna4
import type { JobStatisticsService } from './JobStatisticsService';
import type {
	QueueSnapshot,
	QueueEstimate,
	QueueJob,
	ScheduleContext
} from './QueueEtaService.types';
/** Greedy FIFO scheduling within independent model pools, including occupied slots. */
export class QueueEtaService {
	constructor(private readonly statistics: JobStatisticsService) {}
	estimate(queue: QueueSnapshot, now: number = Date.now()): QueueEstimate {
		for (const slots of Object.values(queue.slots))
			if (!Number.isSafeInteger(slots) || slots < 0 || slots > 10000)
				throw new RangeError('Slots must be integers from 0 to 10000');
		const result: QueueEstimate = {
			status: 'empty',
			queued: queue.queued.length,
			running: queue.running.length,
			slots: queue.slots,
			p50Ms: 0,
			p90Ms: 0,
			finish: { p50: null, p90: null },
			estimates: [],
			warnings: [...(queue.warnings ?? [])]
		};
		const median = this.schedule(queue, now, result);
		if (result.status === 'blocked' || result.status === 'unknown')
			return { ...result, p50Ms: null, p90Ms: null };
		result.p50Ms = median;
		result.p90Ms = this.schedule(queue, now, result, true);
		result.finish = { p50: this.clock(now + result.p50Ms), p90: this.clock(now + result.p90Ms) };
		result.estimates = [
			...new Map(
				result.estimates.map((e) => [
					JSON.stringify([e.type, e.model, e.fallback, e.conditionalCount]),
					e
				])
			).values()
		];
		result.warnings = [...new Set(result.warnings)];
		return result;
	}
	private schedule(
		queue: QueueSnapshot,
		now: number,
		result: QueueEstimate,
		upper = false
	): number {
		const lanes = new Map<string, number[]>();
		for (const job of [...queue.running, ...queue.queued])
			if (!this.scheduleJob({ queue, now, result, upper, lanes }, job)) return 0;
		return Math.max(0, ...[...lanes.values()].flat());
	}
	private scheduleJob(context: ScheduleContext, job: QueueJob): boolean {
		const { queue, now, result, upper, lanes } = context;

		const pool = job.type === 'reverify' ? 'reverify' : job.model;
		const count = queue.slots[pool] ?? 0;
		if (!count) {
			result.status = 'blocked';
			result.warnings.push(`No live capacity for ${pool}; set --slots explicitly`);
			return false;
		}
		const estimate = this.statistics.estimate(job.type, job.model, this.elapsed(queue, job, now));
		if (!estimate) {
			result.status = 'unknown';
			result.warnings.push(`No duration samples for ${job.type}/${job.model}`);
			return false;
		}
		const times = lanes.get(pool) ?? Array.from({ length: count }, () => 0);
		const lane = times.indexOf(Math.min(...times));
		times[lane] += upper ? estimate.p90Ms : estimate.medianMs;
		lanes.set(pool, times);
		result.estimates.push(estimate);
		result.status = 'estimated';
		if (estimate.tailExtrapolated)
			result.warnings.push(
				`Running ${job.id ?? job.type} exceeds every sample; residual tail extrapolated`
			);
		return true;
	}
	private elapsed(queue: QueueSnapshot, job: QueueJob, now: number): number {
		if (!queue.running.includes(job)) return 0;
		return Math.max(0, now - (job.startedAt ?? now));
	}
	private clock(time: number): string {
		return (
			new Intl.DateTimeFormat('en-GB', {
				timeZone: 'Europe/Lisbon',
				dateStyle: 'medium',
				timeStyle: 'long'
			}).format(time) + ' Europe/Lisbon'
		);
	}
}
