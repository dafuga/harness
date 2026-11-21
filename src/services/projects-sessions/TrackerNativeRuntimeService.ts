// @harness-uid u_bl6xl2h4a3
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerNotificationSourceRepository } from '../../repositories/projects-sessions/TrackerNotificationSourceRepository';
import { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerAdapterPollService } from './TrackerAdapterPollService';
import { TrackerHubSyncService } from './TrackerHubSyncService';
import { TrackerLocalApiService } from './TrackerLocalApiService';
import type { TrackerNativeRuntimeOptions } from './TrackerNativeRuntimeService.types';
import { TrackerNotificationService } from './TrackerNotificationService';
import { TrackerPersistenceService } from './TrackerPersistenceService';
import { TrackerSpokeLoopService } from './TrackerSpokeLoopService';

/** Composes the Tracker node's API, delivery and link workers over one SQLite journal. */
export class TrackerNativeRuntimeService {
	readonly store: TrackerPersistenceService;
	readonly items: TrackerLocalApiService;
	readonly notifications?: TrackerNotificationService;
	readonly adapter?: TrackerAdapterPollService;
	readonly sync?: TrackerHubSyncService;
	private readonly links: TrackerSpokeLoopService[];

	constructor(database: SqliteDatabase, options: TrackerNativeRuntimeOptions) {
		validateLinks(options);
		const { node, now, storage, adapter, syncResponder, notification } = options;
		const store = new TrackerPersistenceService(database, node, { ...storage, now });
		this.store = store;
		this.items = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
			now,
			timeZone: options.timeZone,
			ladderConfig: options.ladderConfig,
			validateModel: options.validateModel,
			planLaunch: options.planLaunch,
			runs: new TrackerRunReadRepository(database, node)
		});
		this.links = (options.links ?? []).map(
			(link) => new TrackerSpokeLoopService({ ...link, store })
		);
		if (adapter) this.adapter = new TrackerAdapterPollService(store, adapter);
		if (syncResponder) this.sync = new TrackerHubSyncService({ ...syncResponder, store });
		if (notification) this.notifications = composeNotifications(store, options, notification);
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

function validateLinks({ links = [], role }: TrackerNativeRuntimeOptions): void {
	if (role === 'hub' && links.length) throw new Error('A Tracker hub cannot have spoke links');
	const kinds = new Set(links.map((link) => link.link ?? 'hub'));
	if (kinds.size !== links.length) throw new Error('Duplicate Tracker spoke link');
}

function composeNotifications(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	notification: NonNullable<TrackerNativeRuntimeOptions['notification']>
) {
	const { resolveDestination, ...delivery } = notification;
	return new TrackerNotificationService({
		...delivery,
		role: options.role,
		now: options.now ?? Date.now,
		source: new TrackerNotificationSourceRepository(store, {
			timeZone: options.timeZone ?? 'Europe/Lisbon',
			resolveDestination
		})
	});
}
