// @harness-uid u_e2ojd6mrnw
import type {
	QaSyncConfig,
	QaSyncOptions,
	QaSyncReport,
	QaSyncState,
	QaTrackerItem
} from '../../core/agents-providers/qaSync.types';
import { discoverQaThreads } from './qa-sync-service/discoverQaThreads';
import type { QaCandidate } from './qa-sync-service/discoverQaThreads.types';
import type { QaRun, QaSyncPorts } from './qa-sync-service/qaRun.types';
import { syncQaApprovals } from './qa-sync-service/syncQaApprovals';
import { syncQaReplies } from './qa-sync-service/syncQaReplies';

const daySeconds = 86_400;

/**
 * One heuristic pass over a project's Slack QA threads: tester check marks and retest requests
 * become GitHub labels, and new human replies become tracker notes. No model is involved.
 */
export class QaSyncService {
	constructor(
		private readonly config: QaSyncConfig,
		private readonly ports: QaSyncPorts
	) {}

	async sync(options: QaSyncOptions = {}): Promise<QaSyncReport> {
		const run = await this.start(!!options.dryRun);
		const now = (this.ports.now ?? Date.now)() / 1000;
		const state: QaSyncState = (await this.ports.state.load()) ?? {
			version: 1,
			since: options.backfillComments ? '0' : now.toFixed(6),
			threads: {}
		};
		const oldest = (now - this.config.lookbackDays * daySeconds).toFixed(6);
		const candidates = await discoverQaThreads(run, state, oldest);
		prune(state, candidates, Number(oldest));
		for (const candidate of candidates) {
			await this.syncThread(run, candidate);
			// Saved per thread so an interrupted run does not repeat its notes.
			if (!run.report.dryRun) await this.ports.state.save(state);
		}
		if (!run.report.dryRun) await this.ports.state.save(state);
		run.report.threads = candidates.length;
		return run.report;
	}

	private async start(dryRun: boolean): Promise<QaRun> {
		const { workspaceUrl } = await this.ports.slack.identity();
		let items: Promise<QaTrackerItem[]> | undefined;
		return {
			config: this.config,
			ports: this.ports,
			report: { dryRun, threads: 0, actions: [], warnings: [], errors: [] },
			workspaceUrl,
			items: () => (items ??= this.ports.tracker.openItems())
		};
	}

	/** One failing thread is reported and retried next run without stopping the others. */
	private async syncThread(run: QaRun, { thread, parent }: QaCandidate): Promise<void> {
		const failed = (step: string, error: unknown) =>
			run.report.errors.push(`#${thread.issue} ${step}: ${(error as Error).message}`);
		await syncQaApprovals(run, thread, parent).catch((error) => failed('approval', error));
		if (Number(parent.latestReply ?? 0) <= Number(thread.cursor)) return;
		try {
			const replies = await this.ports.slack.replies(thread.channel, thread.parentTs);
			await syncQaReplies(run, thread, replies);
		} catch (error) {
			failed('replies', error);
		}
	}
}

/** Threads whose parent left the lookback window are no longer watched. */
function prune(state: QaSyncState, candidates: readonly QaCandidate[], oldest: number): void {
	const live = new Set(candidates.map((candidate) => candidate.thread));
	for (const [key, thread] of Object.entries(state.threads))
		if (!live.has(thread) && Number(thread.parentTs) < oldest) delete state.threads[key];
}
