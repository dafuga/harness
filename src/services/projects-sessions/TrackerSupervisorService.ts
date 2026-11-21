// @harness-uid u_46eur7qage
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerNativeRuntimeService } from './TrackerNativeRuntimeService';
import type {
	TrackerSupervisorOptions,
	TrackerSupervisorWorker
} from './TrackerSupervisorService.types';
import { trackerSupervisorStatus } from './tracker-supervisor-service/trackerSupervisorStatus';

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

	async run(signal: AbortSignal): Promise<void> {
		if (this.running) throw new TypeError('Tracker supervisor is already running');
		if (signal.aborted) return;
		this.running = true;
		const controller = new AbortController();
		const lifetime = AbortSignal.any([signal, controller.signal]);
		const workers = [this.runtime.runLinks(lifetime), this.poll(lifetime)];
		try {
			await Promise.all(workers);
		} finally {
			controller.abort();
			await Promise.allSettled(workers);
			this.running = false;
		}
	}

	private async poll(signal: AbortSignal): Promise<void> {
		const workers = this.workers();
		while (!signal.aborted) {
			for (const [name, tick] of workers) {
				if (signal.aborted) return;
				try {
					await tick(signal);
				} catch (error) {
					if (!signal.aborted) this.options.onError?.(name, error);
				}
			}
			await delay(this.options.intervalMs ?? 5_000, undefined, { signal }).catch(() => {});
		}
	}

	private workers() {
		const { scheduler, notifications } = this.runtime;
		const ticks = {
			...(scheduler && { dispatch: (signal: AbortSignal) => scheduler.tick(signal) }),
			...(notifications && { notifications: () => notifications.tick() }),
			...this.options.ticks
		};
		return Object.entries(ticks) as [
			TrackerSupervisorWorker,
			(signal: AbortSignal) => Promise<void>
		][];
	}
}
