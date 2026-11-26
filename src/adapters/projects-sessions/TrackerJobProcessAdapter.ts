// @harness-uid u_h34aydgrjc
import { createHash } from 'node:crypto';
import type {
	TrackerBoxJobRunner,
	TrackerRecurringJobReceipt,
	TrackerRecurringJobRequest
} from '../../services/projects-sessions/TrackerRecurringService.types';
import { runTrackerJobCommand } from './tracker-job-process-adapter/runTrackerJobCommand';
import { trackerJobReceipts } from './tracker-job-process-adapter/trackerJobReceipts';

const concurrentJobs = 2;
const lost = 'interrupted: Tracker stopped before the job reported a result';

/** Runs box jobs in the background and keeps each item's latest receipt on disk. */
export class TrackerJobProcessAdapter implements TrackerBoxJobRunner {
	private readonly jobs = new Map<string, { itemId: string; done: Promise<void> }>();
	private readonly receipts: ReturnType<typeof trackerJobReceipts>;

	constructor(private readonly directory: string) {
		this.receipts = trackerJobReceipts(directory);
	}

	busy(): boolean {
		return this.jobs.size >= concurrentJobs;
	}

	running(itemId: string): boolean {
		return [...this.jobs.values()].some((job) => job.itemId === itemId);
	}

	async start(request: TrackerRecurringJobRequest, signal: AbortSignal): Promise<undefined> {
		const { key, item_id: itemId } = request;
		if (this.jobs.has(key)) return;
		const done = this.test(request, signal)
			.then((receipt) => this.receipts.write(itemId, digest(key), receipt))
			// Without a stored receipt, the next observation reports the job as interrupted.
			.catch(() => {})
			.finally(() => this.jobs.delete(key));
		this.jobs.set(key, { itemId, done });
	}

	async observe(
		request: TrackerRecurringJobRequest
	): Promise<TrackerRecurringJobReceipt | undefined> {
		const { key, item_id: itemId } = request;
		if (this.jobs.has(key)) return undefined;
		// A job is never rerun: it may have acted before its result was lost.
		return this.receipts.read(itemId, digest(key)) ?? { code: 1, timedOut: false, output: lost };
	}

	test(
		request: Omit<TrackerRecurringJobRequest, 'key'>,
		signal: AbortSignal
	): Promise<TrackerRecurringJobReceipt> {
		return runTrackerJobCommand(this.directory, request, signal);
	}

	async drain(): Promise<void> {
		await Promise.all([...this.jobs.values()].map(({ done }) => done));
	}
}

function digest(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}
