// @harness-uid u_wlip653voz
import { TrackerAdapterRepository } from '../../repositories/projects-sessions/TrackerAdapterRepository';
import { TrackerAdapterSourceRepository } from '../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type { TrackerAdapterSource } from '../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterAction,
	TrackerAdapterIntakeContext,
	TrackerAdapterPollDependencies,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult,
	TrackerAdapterReadQuery,
	TrackerAdapterWriteError
} from './TrackerAdapterPollService.types';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerAdapterOwner } from './tracker-adapter-poll-service/manageTrackerAdapterSource.types';
import {
	readTrackerComments,
	readTrackerIssues
} from './tracker-adapter-poll-service/readTrackerIntake';
import { unlinkedRepository } from './tracker-adapter-poll-service/manageTrackerAdapterSource';
import {
	assertTrackerPollActive,
	TrackerAdapterPollError
} from './tracker-adapter-poll-service/trackerAdapterPollError';

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
const commentBackfillMs = 7 * 86_400_000;
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

	status(): { runner: string; active: boolean } {
		const runner = this.dependencies.lease.owner;
		return {
			runner,
			active:
				runner === this.store.node &&
				(!this.sources.isInitialized() || this.sources.isOwner(runner, false))
		};
	}

	owner(): TrackerAdapterOwner {
		return { sources: this.sources, lease: this.dependencies.lease, node: this.store.node };
	}

	/** Preview a source that is not saved yet. Nothing is written, so any configured node may. */
	preview(
		source: TrackerAdapterSource,
		query: TrackerAdapterReadQuery
	): Promise<{ actions: TrackerAdapterAction[]; events: number }> {
		const context = this.intakeContext(source);
		const repository = unlinkedRepository(this.repository);
		return readTrackerIssues({ ...context, repository }, source, query, true);
	}

	async tick(signal: AbortSignal): Promise<void> {
		if (this.dependencies.manual || !this.status().active || !this.sources.isInitialized()) return;
		const errors: unknown[] = [];
		for (const id of this.sources.dueSourceIds(this.now())) {
			signal.throwIfAborted();
			try {
				await this.poll(id, { signal });
			} catch (error) {
				errors.push(error);
			}
		}
		if (errors.length) throw new AggregateError(errors, 'Tracker adapters failed to poll');
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
		const dryRun = Boolean(options.dryRun);
		const commentsOnly = Boolean(options.backfillComments);
		const query = {
			since: commentsOnly ? startedAt - commentBackfillMs : source.cursor - overlapMs,
			backfill: Boolean(options.backfill),
			signal
		};
		try {
			const context = this.intakeContext(source);
			const result = await pollIntake(context, source, query, { dryRun, commentsOnly });
			if (dryRun || commentsOnly) return { ...result, synced_back: 0, sync_errors: [] };
			this.sources.advance(source.id, startedAt);
			const sync = await syncBack(context, source, signal);
			assertTrackerPollActive(signal);
			this.sources.recordRun(source.id, this.now(), sync.sync_errors[0]?.error ?? null);
			return { ...result, ...sync };
		} catch {
			assertTrackerPollActive(signal);
			if (!dryRun && !commentsOnly) this.sources.recordRun(source.id, this.now(), intakeError);
			throw new TrackerAdapterPollError(intakeError);
		}
	}

	private intakeContext(source: TrackerAdapterSource): TrackerAdapterIntakeContext {
		return {
			repository: this.repository,
			store: this.store,
			dependencies: this.dependencies,
			policy: this.dependencies.intakePolicy?.(source)
		};
	}
}

async function pollIntake(
	context: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	query: TrackerAdapterReadQuery,
	options: { dryRun: boolean; commentsOnly: boolean }
) {
	if (options.commentsOnly && query.backfill)
		throw new TypeError('Only one backfill mode is allowed');
	const issues = options.commentsOnly
		? { actions: [], events: 0 }
		: await readTrackerIssues(context, source, query, options.dryRun);
	const comments = await readTrackerComments(context, source, query, options);
	assertTrackerPollActive(query.signal);
	return {
		status: 'polled' as const,
		id: source.id,
		dry_run: options.dryRun,
		actions: [...issues.actions, ...comments.actions],
		events: issues.events + comments.events
	};
}

async function syncBack(
	{ dependencies, repository }: TrackerAdapterIntakeContext,
	source: TrackerAdapterSource,
	signal: AbortSignal
) {
	const { provider, hasStarted } = dependencies;
	const sync_errors: TrackerAdapterWriteError[] = [];
	let synced_back = 0;
	if (!provider.markTracked || !hasStarted) return { synced_back, sync_errors };
	for (const link of repository.pending(source.id)) {
		assertTrackerPollActive(signal);
		const item = repository.item(link.item_id);
		if (!item || item.deleted) continue;
		try {
			if (!hasStarted(item.id)) continue;
			await provider.markTracked(source, link.external_key, signal);
			assertTrackerPollActive(signal);
			repository.acknowledgeWrite(link);
			synced_back++;
		} catch {
			assertTrackerPollActive(signal);
			sync_errors.push({ external_id: link.external_id, error: writeBackError });
		}
	}
	return { synced_back, sync_errors };
}
