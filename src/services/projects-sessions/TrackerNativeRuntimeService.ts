// @harness-uid u_bl6xl2h4a3
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerDispatcherService } from '../agents-providers/TrackerDispatcherService';
import type { TrackerDispatchSchedulerService } from './TrackerDispatchSchedulerService';
import { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
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
	composeTrackerTelemetry
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
	private readonly links: TrackerSpokeLoopService[];

	constructor(database: SqliteDatabase, options: TrackerNativeRuntimeOptions) {
		validateLinks(options);
		const { node, now, storage, adapter, syncResponder, notification } = options;
		const store = new TrackerPersistenceService(database, node, { ...storage, now });
		this.store = store;
		this.role = options.role;
		const runs = new TrackerRunReadRepository(database, node);
		if (notification) this.notifications = composeNotifications(store, options, notification);
		const recurring = composeRecurrence(store, options, this.notifications);
		this.recurring = recurring?.worker;
		this.items = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
			now,
			timeZone: options.timeZone,
			ladderConfig: options.ladderConfig,
			validateModel: options.validateModel,
			planLaunch: options.planLaunch,
			runs,
			recurring: {
				role: this.role,
				history: recurring && ((id, limit) => recurring.repo.history(id, limit))
			}
		});
		this.links = composeTrackerLinks(store, options);
		if (adapter) this.adapter = new TrackerAdapterPollService(store, adapter);
		const dispatcher = composeTrackerDispatch(store, options);
		this.dispatch = dispatcher?.dispatch;
		this.scheduler = dispatcher?.scheduler;
		this.telemetry = composeTrackerTelemetry(store, runs, options);
		if (syncResponder) {
			const runStore = dispatcher ? () => runs : undefined;
			this.sync = new TrackerHubSyncService({ runs: runStore, ...syncResponder, store });
		}
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
	options: TrackerNativeRuntimeOptions,
	notification: NonNullable<TrackerNativeRuntimeOptions['notification']>
) {
	const { resolveDestination, legacyDestinations, ...delivery } = notification;
	return new TrackerNotificationService({
		...delivery,
		role: options.role,
		now: options.now ?? Date.now,
		source: new TrackerNotificationSourceRepository(store, {
			timeZone: options.timeZone ?? 'Europe/Lisbon',
			resolveDestination:
				resolveDestination ?? configuredTrackerDestinations(legacyDestinations ?? {})
		})
	});
}
