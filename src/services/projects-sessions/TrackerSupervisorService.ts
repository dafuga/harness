// @harness-uid u_46eur7qage
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerNativeRuntimeService } from './TrackerNativeRuntimeService';
import type {
	TrackerSupervisorOptions,
	TrackerSupervisorWorker
} from './TrackerSupervisorService.types';
import { batchTrackerLaunchEvents } from './tracker-native-runtime-service/trackerLaunchEventBatch';
import { trackerSupervisorStatus } from './tracker-supervisor-service/trackerSupervisorStatus';
import { assertTrackerLegacyRollbackSafe } from './tracker-supervisor-service/assertTrackerLegacyRollbackSafe';
import { trackerHubChiefDelivery } from './tracker-native-runtime-service/trackerHubChiefMessages';
import { publishApprovedReviews } from './tracker-native-runtime-service/trackerChiefReviewQueue';

/** Owns one node's workers and drains in-flight work before returning database ownership. */
export class TrackerSupervisorService {
	private running = false;
	private readonly startedAt: string;

	constructor(
		private readonly runtime: TrackerNativeRuntimeService,
		private readonly options: TrackerSupervisorOptions = {}
	) {
		this.startedAt = new Date((options.now ?? Date.now)()).toISOString();
	}

	status() {
		return trackerSupervisorStatus(this.runtime, this.startedAt, this.options.views?.());
	}

	assertLegacyRollbackSafe(): void {
		if (this.running)
			throw new DOMException(
				'Stop and drain the native Tracker workers before checking rollback',
				'InvalidStateError'
			);
		assertTrackerLegacyRollbackSafe(this.runtime.store.database);
	}

	async run(signal: AbortSignal): Promise<void> {
		if (this.running) throw new TypeError('Tracker supervisor is already running');
		if (signal.aborted) return;
		this.running = true;
		const controller = new AbortController();
		const lifetime = AbortSignal.any([signal, controller.signal]);
		const workers = [
			this.runtime.runLinks(lifetime),
			...this.workers().map(([name, tick]) => this.poll(name, tick, lifetime))
		];
		try {
			await Promise.all(workers);
		} finally {
			controller.abort();
			await Promise.allSettled(workers);
			await this.runtime.recurring?.drain();
			this.running = false;
		}
	}

	private async poll(
		name: TrackerSupervisorWorker,
		tick: (signal: AbortSignal) => Promise<void>,
		signal: AbortSignal
	): Promise<void> {
		while (!signal.aborted) {
			try {
				await tick(signal);
			} catch (error) {
				if (!signal.aborted) this.options.onError?.(name, error);
			}
			await delay(this.options.intervalMs ?? 5_000, undefined, { signal }).catch(() => {});
		}
	}

	private workers() {
		const { scheduler, notifications, recurring, adapter, telemetry, watchdog, backups } =
			this.runtime;
		const chiefMessages = chiefMessageWorker(this.runtime);
		const ticks = {
			...ignoreExpiryWorker(this.runtime),
			...chiefReviewWorker(this.runtime),
			...(telemetry && { telemetry }),
			...(backups.service && { backup: () => backups.service!.tick() }),
			...webPushWorker(this.runtime),
			...(watchdog && { watchdog: watchdog.tick }),
			...(scheduler && { dispatch: (signal: AbortSignal) => scheduler.tick(signal) }),
			...(recurring && { recurring: (signal: AbortSignal) => recurring.tick(signal) }),
			...((scheduler ?? notifications) && {
				notifications: async () => {
					batchTrackerLaunchEvents(this.runtime);
					await notifications?.tick();
				}
			}),
			...(adapter && { adapter: (signal: AbortSignal) => adapter.tick(signal) }),
			...(chiefMessages && { messages: chiefMessages }),
			...this.options.ticks
		};
		return Object.entries(ticks) as [
			TrackerSupervisorWorker,
			(signal: AbortSignal) => Promise<void>
		][];
	}
}

function ignoreExpiryWorker({ ignoreExpiry }: TrackerNativeRuntimeService) {
	return ignoreExpiry && { 'ignore-expiry': async () => ignoreExpiry() };
}

function chiefReviewWorker({ role, store, now }: TrackerNativeRuntimeService) {
	return role === 'hub' && { 'chief-review': async () => publishApprovedReviews(store, now()) };
}

/** On the hub: tells Daniel's browsers about open decisions. */
function webPushWorker({ webPush }: TrackerNativeRuntimeService) {
	return webPush && { web_push: () => webPush.tick() };
}

/** On the hub: sends Chief of Staff's Hub messages through its notification channel. */
function chiefMessageWorker(runtime: TrackerNativeRuntimeService) {
	if (runtime.role !== 'hub') return undefined;
	const { store, now, notifications } = runtime;
	return trackerHubChiefDelivery({ store, now, channel: () => notifications?.chiefChannel() });
}
