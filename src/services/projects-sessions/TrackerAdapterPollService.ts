// @harness-uid u_wlip653voz
import { TrackerAdapterRepository } from '../../repositories/projects-sessions/TrackerAdapterRepository';
import { TrackerAdapterSourceRepository } from '../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type { TrackerAdapterSource } from '../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterPollDependencies,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult,
	TrackerAdapterWriteError
} from './TrackerAdapterPollService.types';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import {
	readTrackerComments,
	readTrackerIssues
} from './tracker-adapter-poll-service/readTrackerIntake';
import { assertTrackerPollActive } from './tracker-adapter-poll-service/assertTrackerPollActive';

export type {
	TrackerAdapterIntakePolicy,
	TrackerAdapterLease,
	TrackerAdapterPollDependencies,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult,
	TrackerAdapterReadQuery,
	TrackerGithubAdapterProvider,
	TrackerGithubComment,
	TrackerGithubIssue,
	TrackerGithubTimelineEvent
} from './TrackerAdapterPollService.types';

const overlapMs = 5_000;
const intakeError = 'Tracker adapter intake failed';
const writeBackError = 'Tracker adapter write-back failed';

/** Poll one persisted source while holding the injected owner's exclusive lease. */
export class TrackerAdapterPollService {
	private readonly sources: TrackerAdapterSourceRepository;
	private readonly repository: TrackerAdapterRepository;
	private readonly now: () => number;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly dependencies: TrackerAdapterPollDependencies
	) {
		this.repository = new TrackerAdapterRepository(store.database);
		this.sources = new TrackerAdapterSourceRepository(store.database);
		this.now = dependencies.now ?? Date.now;
	}

	async poll(
		id: string,
		options: TrackerAdapterPollOptions = {}
	): Promise<TrackerAdapterPollResult> {
		const { lease } = this.dependencies;
		if (this.store.node !== lease.owner) return { status: 'not-owner' };
		const signal = options.signal ?? new AbortController().signal;
		assertTrackerPollActive(signal);
		const release = lease.tryAcquire();
		if (!release) return { status: 'lease-busy' };
		try {
			return await this.pollLeasedSource(id, options, signal);
		} finally {
			release();
		}
	}

	private async pollLeasedSource(
		id: string,
		options: TrackerAdapterPollOptions,
		signal: AbortSignal
	): Promise<TrackerAdapterPollResult> {
		if (!options.dryRun) this.sources.initialize();
		if (!this.sources.isInitialized()) return { status: 'inactive' };
		const source = this.sources.source(id);
		if (!source || (source.paused && !options.dryRun)) return { status: 'inactive' };
		if (!this.sources.isOwner(this.store.node, !options.dryRun)) return { status: 'not-owner' };
		return this.pollSource(source, options, signal);
	}

	private async pollSource(
		source: TrackerAdapterSource,
		options: TrackerAdapterPollOptions,
		signal: AbortSignal
	): Promise<TrackerAdapterPollResult> {
		const startedAt = this.now();
		const dryRun = options.dryRun ?? false;
		const query = { since: source.cursor - overlapMs, backfill: options.backfill ?? false, signal };
		try {
			const context = {
				repository: this.repository,
				store: this.store,
				dependencies: this.dependencies,
				policy: this.dependencies.intakePolicy?.(source)
			};
			const { actions, events } = await readTrackerIssues(context, source, query, dryRun);
			const result = { status: 'polled' as const, id: source.id, dry_run: dryRun, actions };
			assertTrackerPollActive(signal);
			if (dryRun) return { ...result, events: 0, synced_back: 0, sync_errors: [] };
			const comments = await readTrackerComments(context, source, query);
			assertTrackerPollActive(signal);
			this.sources.advance(source.id, startedAt);
			const sync = await this.syncBack(source, signal);
			assertTrackerPollActive(signal);
			this.sources.recordRun(source.id, this.now(), sync.sync_errors[0]?.error ?? null);
			return { ...result, events: events + comments, ...sync };
		} catch {
			assertTrackerPollActive(signal);
			if (!dryRun) this.sources.recordRun(source.id, this.now(), intakeError);
			throw new Error(intakeError);
		}
	}

	private async syncBack(source: TrackerAdapterSource, signal: AbortSignal) {
		const { provider, hasStarted } = this.dependencies;
		const sync_errors: TrackerAdapterWriteError[] = [];
		let synced_back = 0;
		if (!provider.markTracked || !hasStarted) return { synced_back, sync_errors };
		for (const link of this.repository.pending(source.id)) {
			assertTrackerPollActive(signal);
			const item = this.repository.item(link.item_id);
			if (!item || item.deleted) continue;
			try {
				if (!hasStarted(item.id)) continue;
				await provider.markTracked(source, link.external_key, signal);
				assertTrackerPollActive(signal);
				this.repository.acknowledgeWrite(link);
				synced_back++;
			} catch {
				assertTrackerPollActive(signal);
				sync_errors.push({ external_id: link.external_id, error: writeBackError });
			}
		}
		return { synced_back, sync_errors };
	}
}
