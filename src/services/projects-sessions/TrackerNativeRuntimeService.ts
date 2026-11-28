// @harness-uid u_bl6xl2h4a3
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerLadderConfig } from '../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerDispatcherService } from '../agents-providers/TrackerDispatcherService';
import type { TrackerDispatchSchedulerService } from './TrackerDispatchSchedulerService';
import { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerNotificationQueueRepository } from '../../repositories/projects-sessions/TrackerNotificationQueueRepository';
import { TrackerNotificationSourceRepository } from '../../repositories/projects-sessions/TrackerNotificationSourceRepository';
import { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerRecurringRepository } from '../../repositories/projects-sessions/TrackerRecurringRepository';
import { composeTrackerBackups } from './tracker-backup-service/composeTrackerBackups';
import type { TrackerAdapterPollService } from './TrackerAdapterPollService';
import type { TrackerHubSyncService } from './TrackerHubSyncService';
import { TrackerLocalApiService } from './TrackerLocalApiService';
import { TrackerPhoneReplicaService } from './TrackerPhoneReplicaService';
import type {
	TrackerDuePreviewPolicy,
	TrackerNativeRuntimeOptions
} from './TrackerNativeRuntimeService.types';
import { TrackerNotificationService } from './TrackerNotificationService';
import { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerSpokeLoopService } from './TrackerSpokeLoopService';
import { TrackerRecurringService } from './TrackerRecurringService';
import { trackerAutolaunchAdmin } from './tracker-native-runtime-service/trackerAutolaunchAdmin';
import { composeTrackerResponder } from './tracker-native-runtime-service/composeTrackerResponder';
import { composeTrackerRecurrence } from './tracker-native-runtime-service/composeTrackerRecurrence';
import { composeTrackerIgnoreExpiry } from './tracker-native-runtime-service/composeTrackerIgnoreExpiry';
import { composeTrackerWebPush } from './tracker-native-runtime-service/composeTrackerWebPush';
import { configuredHostAdapter } from './tracker-native-runtime-service/trackerHostAdapter';
import {
	configuredHostWatchdog,
	type trackerHostWatchdog
} from './tracker-native-runtime-service/trackerHostWatchdog';
import { configuredHostDispatch } from './tracker-native-runtime-service/trackerHostLaunch';
import { composeTrackerDispatch } from './tracker-native-runtime-service/nativeTrackerDispatch';
import { trackerItemViews } from './tracker-native-runtime-service/trackerLaunchWait';
import {
	composeTrackerLinks,
	trackerSpokeStatus
} from './tracker-native-runtime-service/nativeTrackerLinks';
import { TrackerMachineService } from './TrackerMachineService';
import { composeTrackerFleet } from './tracker-native-runtime-service/composeTrackerFleet';
import { configuredTrackerReminderHost } from './tracker-native-runtime-service/configuredTrackerReminderHost';
import { configuredTrackerDestinations } from './tracker-native-runtime-service/configuredTrackerDestinations';

/** Composes the Tracker node's API, delivery and link workers over one SQLite journal. */
export class TrackerNativeRuntimeService {
	readonly role: 'hub' | 'spoke';
	readonly dispatch?: TrackerDispatcherService;
	readonly scheduler?: TrackerDispatchSchedulerService;
	readonly duePreview: TrackerDuePreviewPolicy;
	readonly backups: ReturnType<typeof composeTrackerBackups>;
	readonly ladderConfig?: TrackerLadderConfig;
	readonly store: TrackerPersistenceService;
	readonly items: TrackerLocalApiService;
	readonly notifications?: TrackerNotificationService;
	readonly webPush?: ReturnType<typeof composeTrackerWebPush>;
	readonly adapter?: TrackerAdapterPollService;
	readonly watchdog?: ReturnType<typeof trackerHostWatchdog>;
	readonly hostEffectsHeld: boolean;
	readonly sync?: TrackerHubSyncService;
	readonly recurring?: TrackerRecurringService;
	readonly ignoreExpiry?: () => void;
	readonly telemetry?: (signal: AbortSignal) => Promise<void>;
	readonly fleetSamples?: () => readonly unknown[];
	readonly machines: TrackerMachineService;
	readonly now: () => number;
	private readonly links: TrackerSpokeLoopService[];

	constructor(database: SqliteDatabase, options: TrackerNativeRuntimeOptions) {
		validateLinks(options);
		const { node, now = Date.now, storage, hostEffects, role } = options;
		const store = (this.store = new TrackerPersistenceService(database, node, { ...storage, now }));
		this.role = role;
		this.ladderConfig = options.ladderConfig;
		this.now = now;
		this.hostEffectsHeld = options.hostEffectsHeld === true;
		const runs = new TrackerRunReadRepository(database, node);
		this.machines = composeMachines(store, options, this.now);
		[this.notifications, this.webPush] = composeOutbound(store, options);
		const recurring = composeTrackerRecurrence(store, options, this.notifications);
		this.recurring = recurring?.worker;
		this.ignoreExpiry = composeTrackerIgnoreExpiry(store, options);
		this.links = composeTrackerLinks(store, options);
		this.adapter = configuredHostAdapter(store, runs, options, this.now);
		const dispatch =
			options.dispatch ?? configuredHostDispatch(store, hostEffects, { ...options, now: this.now });
		const composed = composeTrackerDispatch(store, { ...options, dispatch }, this);
		({
			dispatch: this.dispatch,
			scheduler: this.scheduler,
			duePreview: this.duePreview
		} = composed);
		const fleet = composeTrackerFleet(runs, { ...options, dispatch }, this);
		({ tick: this.telemetry, samples: this.fleetSamples } = fleet);
		this.watchdog = configuredHostWatchdog(this, hostEffects, options.automaticEnabled);
		this.items = composeItemApi(this, runs, fleet.apiOptions(options), recurring);
		this.backups = composeTrackerBackups(this, options);
		this.sync = composeTrackerResponder(this, runs, fleet.syncOptions, composed);
	}

	get admin() {
		return trackerAutolaunchAdmin(this.store, this);
	}

	spokeStatus() {
		return trackerSpokeStatus(this.links);
	}
	kickLinks(): void {
		for (const link of this.links) link.kick();
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

function composeMachines(
	store: TrackerPersistenceService,
	{ machineSampler }: TrackerNativeRuntimeOptions,
	now: () => number
) {
	return new TrackerMachineService(store, { now, sampler: machineSampler });
}

function composeItemApi(
	runtime: TrackerNativeRuntimeService,
	runs: TrackerRunReadRepository,
	{
		now,
		timeZone,
		ladderConfig,
		validateModel,
		planLaunch,
		role,
		manualLaunch,
		phoneWrite
	}: TrackerNativeRuntimeOptions,
	recurring?: ReturnType<typeof composeTrackerRecurrence>
) {
	const { store } = runtime;
	const items = new TrackerItemReadRepository(store.database, runtime.now);
	return new TrackerLocalApiService(store, items, {
		now,
		phoneReplica:
			role === 'hub' ? new TrackerPhoneReplicaService(store, runtime.now, phoneWrite) : undefined,
		timeZone,
		ladderConfig,
		validateModel,
		planLaunch,
		manualLaunch,
		...trackerItemViews(runtime),
		reject: runtime.dispatch && ((id, reason) => runtime.dispatch!.reject(id, reason)),
		runs,
		machines: runtime.machines,
		jobs: recurring?.jobs,
		recurring: {
			role,
			history: recurring && ((id, limit) => recurring.repo.history(id, limit))
		}
	});
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

/** What the node sends out: its notification outbox and Daniel's browser notifications. */
function composeOutbound(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	return [composeNotifications(store, options), composeTrackerWebPush(store, options)] as const;
}

function composeNotifications(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const notification = configuredTrackerReminderHost(options);
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

export {
	TrackerLocalApiService,
	TrackerNotificationService,
	TrackerPersistenceService,
	TrackerRecurringRepository,
	TrackerRecurringService
};
