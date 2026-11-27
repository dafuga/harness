// @harness-uid u_wlip653voz
import { TrackerAdapterRepository } from '../../repositories/projects-sessions/TrackerAdapterRepository';
import { TrackerAdapterSourceRepository } from '../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type {
	TrackerAdapterSource,
	TrackerStoredAdapterSource
} from '../../repositories/projects-sessions/TrackerAdapterRepository.types';
import type {
	TrackerAdapterAction,
	TrackerAdapterIntakeContext,
	TrackerAdapterPollDependencies,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult,
	TrackerAdapterReadQuery
} from './TrackerAdapterPollService.types';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerAdapterOwner } from './tracker-adapter-poll-service/manageTrackerAdapterSource.types';
import { readTrackerIssues } from './tracker-adapter-poll-service/readTrackerIntake';
import { unlinkedRepository } from './tracker-adapter-poll-service/manageTrackerAdapterSource';
import { assertTrackerPollActive } from './tracker-adapter-poll-service/trackerAdapterPollError';

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

import { pollTrackerGithubSource } from './tracker-adapter-poll-service/pollTrackerGithubSource';
import { pollTrackerMessageSource } from './tracker-adapter-poll-service/pollTrackerMessageSource';
import { readTrackerMessageIntake } from './tracker-adapter-poll-service/readTrackerMessageIntake';

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

	supports(type: TrackerStoredAdapterSource['type']): boolean {
		return type === 'github' || Boolean(this.dependencies.messageProviders?.[type]);
	}

	/** Preview a source that is not saved yet. Nothing is written, so any configured node may. */
	preview(
		source: TrackerStoredAdapterSource,
		query: TrackerAdapterReadQuery
	): Promise<{ actions: TrackerAdapterAction[]; events: number }> {
		if (source.type !== 'github')
			return readTrackerMessageIntake(this.intakeContext(), source, {
				query,
				dryRun: true,
				preview: true
			});
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
		return source.type === 'github'
			? pollTrackerGithubSource(this.intakeContext(source), this.sources, source, {
					...options,
					signal
				})
			: pollTrackerMessageSource(this.intakeContext(), this.sources, source, {
					...options,
					signal
				});
	}

	private intakeContext(source?: TrackerAdapterSource): TrackerAdapterIntakeContext {
		return {
			repository: this.repository,
			store: this.store,
			dependencies: this.dependencies,
			policy: source && this.dependencies.intakePolicy?.(source)
		};
	}
}
