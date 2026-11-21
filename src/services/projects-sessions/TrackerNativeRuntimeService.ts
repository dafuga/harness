// @harness-uid u_bl6xl2h4a3
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerDispatcherService } from '../agents-providers/TrackerDispatcherService';
import type { TrackerDispatchSchedulerService } from './TrackerDispatchSchedulerService';
import { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerNotificationQueueRepository } from '../../repositories/projects-sessions/TrackerNotificationQueueRepository';
import { TrackerNotificationSourceRepository } from '../../repositories/projects-sessions/TrackerNotificationSourceRepository';
import { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerRecurringRepository } from '../../repositories/projects-sessions/TrackerRecurringRepository';
import { TrackerAdapterPollService } from './TrackerAdapterPollService';
import { TrackerHubSyncService } from './TrackerHubSyncService';
import { TrackerLocalApiService } from './TrackerLocalApiService';
import type { TrackerNativeRuntimeOptions } from './TrackerNativeRuntimeService.types';
import { TrackerNotificationService } from './TrackerNotificationService';
import { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerSpokeLoopService } from './TrackerSpokeLoopService';
import { TrackerRecurringService } from './TrackerRecurringService';
import { composeTrackerDispatch } from './tracker-native-runtime-service/nativeTrackerDispatch';
import {
	composeTrackerLinks,
	composeTrackerTelemetry,
	trackerSpokeStatus
} from './tracker-native-runtime-service/nativeTrackerLinks';
import { configuredTrackerDestinations } from './tracker-native-runtime-service/configuredTrackerDestinations';

/** Composes the Tracker node's API, delivery and link workers over one SQLite journal. */
export class TrackerNativeRuntimeService {
	readonly role: 'hub' | 'spoke';
	readonly dispatch?: TrackerDispatcherService;
	readonly scheduler?: TrackerDispatchSchedulerService;
	readonly store: TrackerPersistenceService;
	readonly items: TrackerLocalApiService;
	readonly notifications?: TrackerNotificationService;
	readonly adapter?: TrackerAdapterPollService;
	readonly sync?: TrackerHubSyncService;
	readonly recurring?: TrackerRecurringService;
	readonly telemetry?: (signal: AbortSignal) => Promise<void>;
	readonly fleetSamples?: () => readonly unknown[];
	readonly now: () => number;
	private readonly links: TrackerSpokeLoopService[];

	constructor(database: SqliteDatabase, options: TrackerNativeRuntimeOptions) {
		validateLinks(options);
		const { node, now, storage, adapter } = options;
		const store = new TrackerPersistenceService(database, node, { ...storage, now });
		this.store = store;
		this.role = options.role;
		this.now = now ?? Date.now;
		const runs = new TrackerRunReadRepository(database, node);
		this.notifications = composeNotifications(store, options);
		const recurring = composeRecurrence(store, options, this.notifications);
		this.recurring = recurring?.worker;
		this.items = composeItemApi(store, runs, options, recurring?.repo);
		this.links = composeTrackerLinks(store, options);
		if (adapter) this.adapter = new TrackerAdapterPollService(store, adapter);
		({ dispatch: this.dispatch, scheduler: this.scheduler } = composeTrackerDispatch(
			store,
			options
		));
		({ tick: this.telemetry, samples: this.fleetSamples } = composeTrackerTelemetry(
			store,
			runs,
			options
		));
		this.sync = composeResponder(store, runs, options, this.dispatch);
	}

	spokeStatus() {
		return trackerSpokeStatus(this.links);
	}

	/** The service owner awaits shutdown before closing the SQLite handle. */
	async runLinks(signal: AbortSignal): Promise<void> {
		const controller = new AbortController();
		const lifetime = AbortSignal.any([signal, controller.signal]);
		const links = this.links.map((link) => link.run(lifetime));
		try {
			await Promise.all(links);
		} finally {
			controller.abort();
			await Promise.allSettled(links);
		}
	}
}

function composeItemApi(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	{ now, timeZone, ladderConfig, validateModel, planLaunch, role }: TrackerNativeRuntimeOptions,
	recurring?: TrackerRecurringRepository
) {
	return new TrackerLocalApiService(store, new TrackerItemReadRepository(store.database), {
		now,
		timeZone,
		ladderConfig,
		validateModel,
		planLaunch,
		runs,
		recurring: { role, history: recurring && ((id, limit) => recurring.history(id, limit)) }
	});
}

function composeResponder(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	{ syncResponder }: TrackerNativeRuntimeOptions,
	dispatch?: TrackerDispatcherService
) {
	if (!syncResponder) return undefined;
	const runStore = dispatch ? () => runs : undefined;
	return new TrackerHubSyncService({ runs: runStore, ...syncResponder, store });
}

function validateLinks({
	links = [],
	role,
	recurring,
	notification
}: TrackerNativeRuntimeOptions): void {
	if (role === 'hub' && links.length) throw new TypeError('A Tracker hub cannot have spoke links');
	if (recurring && (role !== 'hub' || !notification?.webhook))
		throw new TypeError('Tracker recurrence needs a hub with a configured notification outbox');
	const kinds = new Set(links.map((link) => link.link ?? 'hub'));
	if (kinds.size !== links.length) throw new TypeError('Duplicate Tracker spoke link');
}

function composeRecurrence(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	notifications?: TrackerNotificationService
) {
	if (!options.recurring || !notifications) return undefined;
	const repo = new TrackerRecurringRepository(store);
	const worker = new TrackerRecurringService(repo, {
		now: options.now ?? Date.now,
		enqueue: (entry) => notifications.enqueue(entry),
		jobs: options.recurring.jobs
	});
	return { repo, worker };
}

function composeNotifications(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const { notification } = options;
	if (!notification) return undefined;
	const { resolveDestination, legacyDestinations, queue, ...delivery } = notification;
	const resolve = resolveDestination ?? configuredTrackerDestinations(legacyDestinations ?? {});
	const now = options.now ?? Date.now;
	return new TrackerNotificationService({
		...delivery,
		role: options.role,
		now,
		queue:
			queue ??
			new TrackerNotificationQueueRepository(store.database, { resolveDestination: resolve, now }),
		source: new TrackerNotificationSourceRepository(store, {
			timeZone: options.timeZone ?? 'Europe/Lisbon',
			resolveDestination: resolve
		})
	});
}
