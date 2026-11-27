// @harness-uid u_uhsrsey7pi
import { randomUUID } from 'node:crypto';
import type {
	PrivateBrowserCleanup,
	PrivateBrowserPhase,
	PrivateBrowserReceipt,
	PrivateBrowserRequest
} from './PrivateBrowserGateService.types';

const privateWindowMs = 5 * 60_000;

/** Executor-only admission for one protected browser. The caller supplies authenticated device identities. */
export class PrivateBrowserGateService {
	private phase: PrivateBrowserPhase = 'blocked';
	private readonly reads = new Map<AbortController, Promise<unknown>>();
	private active?: PrivateBrowserRequest;
	private lastReceipt?: PrivateBrowserReceipt;
	private disposing?: Promise<boolean>;
	private stopped?: Promise<boolean>;

	constructor(private readonly cleanup: PrivateBrowserCleanup) {}

	status(): PrivateBrowserPhase {
		return this.phase;
	}

	receipt(): PrivateBrowserReceipt | undefined {
		return this.lastReceipt;
	}

	/** Start closed on boot and after failed cleanup, including when Chrome survived the executor. */
	async recover(): Promise<boolean> {
		if (this.phase !== 'blocked' || this.stopped) return false;
		return this.drainAndDispose(undefined, false);
	}

	/** Stop all admission and drain browser work before the executor exits. */
	close(): Promise<boolean> {
		this.stopped ??= this.disposing ?? this.drainAndDispose(this.active, false);
		return this.stopped;
	}

	/** The executor invokes reviewed reads here and owns their connections and teardown. */
	async read<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
		if (this.phase !== 'ready') return undefined;
		const control = new AbortController();
		const pending = Promise.resolve().then(() =>
			control.signal.aborted ? undefined : operation(control.signal)
		);
		this.reads.set(control, pending);
		try {
			const result = await pending.catch(() => undefined);
			return this.phase === 'ready' && !control.signal.aborted ? result : undefined;
		} finally {
			this.reads.delete(control);
		}
	}

	async request(deviceId: string): Promise<{ requestId: string } | undefined> {
		if (this.phase !== 'ready' || !deviceId) return undefined;
		this.phase = 'draining';
		const window = openWindow(deviceId, this.reads.values(), (id) => void this.cancel(id));
		const { requestId } = window;
		this.active = window;
		for (const read of this.reads.keys()) read.abort();
		await window.drained;
		if (this.phase !== 'draining' || this.active !== window) return undefined;
		if (performance.now() >= window.expiresAt) {
			await this.cancel(requestId);
			return undefined;
		}
		this.phase = 'private';
		return { requestId };
	}

	permitsInput(requestId: string, deviceId: string): boolean {
		return this.phase === 'private' && authorizesInput(this.active, requestId, deviceId);
	}

	/** Revokes live viewer input before the executor opens a sealed field. */
	async nativeInput(
		requestId: string,
		deviceId: string,
		operation: (signal: AbortSignal) => Promise<void>
	): Promise<boolean> {
		const window = this.active;
		if (!window || !this.permitsInput(requestId, deviceId)) return false;
		const controller = new AbortController();
		const drained = Promise.resolve().then(async () => {
			await this.cleanup.revokeInput();
			controller.signal.throwIfAborted();
			await operation(controller.signal);
		});
		window.native = { controller, drained };
		try {
			await drained;
		} catch {
			await this.cancel(requestId);
			return false;
		}
		if (this.active !== window) return false;
		if (performance.now() < window.expiresAt) return this.drainAndDispose(window, true);
		await this.cancel(requestId);
		return false;
	}

	async finish(requestId: string, deviceId: string): Promise<boolean> {
		if (!this.permitsInput(requestId, deviceId) || !this.active) return false;
		return this.drainAndDispose(this.active, true);
	}

	async cancel(requestId: string): Promise<boolean> {
		if (this.active?.requestId !== requestId) return false;
		return this.drainAndDispose(this.active, false);
	}

	private drainAndDispose(window: PrivateBrowserRequest | undefined, verify: boolean) {
		this.phase = 'disposing';
		this.active = undefined;
		const drained = stopBrowserOperations(this.reads, window);
		return (this.disposing = this.clean(drained, verify, window?.requestId));
	}

	private async clean(drained: Promise<unknown>, verify: boolean, requestId?: string) {
		await drained;
		const ready = await dispose(this.cleanup, verify);
		this.disposing = undefined;
		if (requestId) this.lastReceipt = { requestId, outcome: outcome(ready, verify) };
		this.phase = ready && !this.stopped ? 'ready' : 'blocked';
		return ready;
	}
}

function authorizesInput(
	window: PrivateBrowserRequest | undefined,
	requestId: string,
	deviceId: string
): boolean {
	return (
		window?.requestId === requestId &&
		window.deviceId === deviceId &&
		!window.native &&
		performance.now() < window.expiresAt
	);
}

function stopBrowserOperations(
	reads: ReadonlyMap<AbortController, Promise<unknown>>,
	window: PrivateBrowserRequest | undefined
) {
	if (window) clearTimeout(window.expiry);
	for (const read of reads.keys()) read.abort();
	window?.native?.controller.abort();
	return Promise.allSettled([...reads.values(), window?.native?.drained]);
}

function openWindow(
	deviceId: string,
	reads: Iterable<Promise<unknown>>,
	expire: (requestId: string) => void
): PrivateBrowserRequest {
	const requestId = randomUUID();
	const expiry = setTimeout(() => expire(requestId), privateWindowMs);
	expiry.unref();
	return {
		requestId,
		deviceId,
		expiresAt: performance.now() + privateWindowMs,
		expiry,
		drained: Promise.allSettled(reads)
	};
}

async function dispose(cleanup: PrivateBrowserCleanup, verify: boolean): Promise<boolean> {
	try {
		await cleanup.revokeInput();
		await cleanup.disposeForm();
		return !verify || (await cleanup.verifyResult());
	} catch {
		return false;
	}
}

function outcome(ready: boolean, verified: boolean): PrivateBrowserReceipt['outcome'] {
	if (!ready) return 'blocked';
	return verified ? 'completed' : 'aborted';
}
