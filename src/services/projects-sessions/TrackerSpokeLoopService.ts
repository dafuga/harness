// @harness-uid u_7763mfxmkn
import { setTimeout as delay } from 'node:timers/promises';
import type { TrackerSpokeLoopOptions, TrackerSpokeStatus } from './TrackerSpokeLoopService.types';
import { trackerMetaKeys, TrackerSpokeSyncService } from './TrackerSpokeSyncService';

const pushInterval = 30_000;
const initialBackoff = 1000;
const maxBackoff = 60_000;

/** Drives one durable sync link until its owner asks it to stop. */
export class TrackerSpokeLoopService {
	private running = false;
	private hub: string | null = null;
	private readonly state = newSpokeStatus();

	constructor(private readonly options: TrackerSpokeLoopOptions) {}

	get kind() {
		return this.options.link ?? 'hub';
	}

	status() {
		const { store, relayOps } = this.options;
		const peer = this.kind === 'peer';
		const { push, replay } = trackerMetaKeys(peer ? 'peer_' : '');
		const relayAll = (relayOps ?? peer) || store.getMeta(replay) === '1';
		return {
			...this.state,
			pending_push: store.countOpsSince(
				Number(store.getMeta(push)),
				relayAll ? undefined : store.node
			)
		};
	}

	upstream() {
		return this.options.endpoint?.host ?? this.hub;
	}

	async run(signal: AbortSignal): Promise<void> {
		if (this.running) throw new TypeError('Tracker spoke loop is already running');
		if (signal.aborted) return;
		this.running = true;
		try {
			await this.drive(signal);
		} finally {
			this.running = false;
			this.state.connected = false;
		}
	}

	private async drive(signal: AbortSignal): Promise<void> {
		const controller = new AbortController();
		const lifetime = AbortSignal.any([signal, controller.signal]);
		const wake = pushWake(this.options.pushIntervalMs ?? pushInterval, lifetime);
		const link = new TrackerSpokeSyncService({
			...this.options,
			onPushAcknowledged: () => {
				this.state.lastPushOk = this.timestamp();
			},
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
				if (!signal.aborted) this.noteError('push', error);
			}
		}
	}

	private async pull(link: TrackerSpokeSyncService, signal: AbortSignal): Promise<void> {
		let backoff = initialBackoff;
		while (!signal.aborted) {
			try {
				const result = await link.pull();
				if (result.status === 'reset') await link.push();
				if (result.status === 'applied') this.notePull(result.hub, result.duePolicy);
				backoff = initialBackoff;
			} catch (error) {
				if (signal.aborted) return;
				this.noteError('pull', error);
				await delay(backoff, undefined, { signal }).catch(() => {});
				backoff = Math.min(backoff * 2, maxBackoff);
			}
		}
	}

	private notePull(hub: string, duePolicy: unknown): void {
		if (duePolicy !== undefined) this.options.onDuePolicy?.(duePolicy);
		this.hub = hub;
		this.state.connected = true;
		this.state.lastError = null;
		this.state.lastPullOk = this.timestamp();
	}

	private noteError(direction: 'push' | 'pull', error: unknown): void {
		this.state.connected = false;
		this.state.lastError = `${direction} failed`;
		this.options.onError?.(direction, error);
	}

	private timestamp(): string {
		return new Date((this.options.now ?? Date.now)()).toISOString();
	}
}

function newSpokeStatus(): TrackerSpokeStatus {
	return { connected: false, lastPullOk: null, lastPushOk: null, lastError: null };
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
