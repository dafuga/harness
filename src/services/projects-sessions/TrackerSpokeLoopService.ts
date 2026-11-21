// @harness-uid u_7763mfxmkn
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerSpokeLoopOptions } from './TrackerSpokeLoopService.types';
import { TrackerSpokeSyncService } from './TrackerSpokeSyncService';

const pushInterval = 30_000;
const initialBackoff = 1000;
const maxBackoff = 60_000;

/** Drives one durable sync link until its owner asks it to stop. */
export class TrackerSpokeLoopService {
	private running = false;

	constructor(private readonly options: TrackerSpokeLoopOptions) {}

	async run(signal: AbortSignal): Promise<void> {
		if (this.running) throw new Error('Tracker spoke loop is already running');
		if (signal.aborted) return;
		this.running = true;
		try {
			await this.drive(signal);
		} finally {
			this.running = false;
		}
	}

	private async drive(signal: AbortSignal): Promise<void> {
		const controller = new AbortController();
		const lifetime = AbortSignal.any([signal, controller.signal]);
		const wake = pushWake(this.options.pushIntervalMs ?? pushInterval, lifetime);
		const link = new TrackerSpokeSyncService({
			...this.options,
			transport: async (request) => {
				lifetime.throwIfAborted();
				const response = await this.options.transport(request, lifetime);
				lifetime.throwIfAborted();
				return response;
			}
		});
		const unsubscribe = this.options.store.subscribe(wake.request);
		const workers = [this.push(link, wake.wait, lifetime), this.pull(link, lifetime)];
		try {
			await Promise.all(workers);
		} finally {
			controller.abort();
			await Promise.allSettled(workers);
			unsubscribe();
		}
	}

	private async push(
		link: TrackerSpokeSyncService,
		wait: () => Promise<void>,
		signal: AbortSignal
	): Promise<void> {
		while (!signal.aborted) {
			await wait();
			if (signal.aborted) return;
			try {
				await link.push();
			} catch (error) {
				if (!signal.aborted) this.options.onError?.('push', error);
			}
		}
	}

	private async pull(link: TrackerSpokeSyncService, signal: AbortSignal): Promise<void> {
		let backoff = initialBackoff;
		while (!signal.aborted) {
			try {
				const result = await link.pull();
				if (result.status === 'reset') await link.push();
				if (result.status === 'applied' && result.duePolicy !== undefined) {
					this.options.onDuePolicy?.(result.duePolicy);
				}
				backoff = initialBackoff;
			} catch (error) {
				if (signal.aborted) return;
				this.options.onError?.('pull', error);
				await delay(backoff, undefined, { signal }).catch(() => {});
				backoff = Math.min(backoff * 2, maxBackoff);
			}
		}
	}
}

function pushWake(interval: number, signal: AbortSignal) {
	let pending = true;
	let resume: (() => void) | undefined;
	return {
		request: () => {
			pending = true;
			resume?.();
		},
		wait: async () => {
			if (!pending && !signal.aborted) {
				await new Promise<void>((resolve) => {
					const finish = () => {
						clearTimeout(timer);
						signal.removeEventListener('abort', finish);
						resume = undefined;
						resolve();
					};
					const timer = setTimeout(finish, interval);
					resume = finish;
					signal.addEventListener('abort', finish, { once: true });
				});
			}
			pending = false;
		}
	};
}
