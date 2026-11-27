// @harness-uid u_uhsrsey7pi
import { randomUUID } from 'node:crypto';
import type {
	PrivateBrowserCleanup,
	PrivateBrowserPhase,
	PrivateBrowserRequest
} from './PrivateBrowserGateService.types';

const privateWindowMs = 5 * 60_000;

/** Executor-only admission for one protected browser. The caller supplies authenticated device identities. */
export class PrivateBrowserGateService {
	private phase: PrivateBrowserPhase = 'blocked';
	private readonly reads = new Map<AbortController, Promise<unknown>>();
	private active?: PrivateBrowserRequest;

	constructor(private readonly cleanup: PrivateBrowserCleanup) {}

	status(): PrivateBrowserPhase {
		return this.phase;
	}

	/** Start closed on boot and after failed cleanup, including when Chrome survived the executor. */
	async recover(): Promise<boolean> {
		if (this.phase !== 'blocked') return false;
		this.phase = 'disposing';
		return this.clean(false);
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
			const result = await pending;
			return this.phase === 'ready' && !control.signal.aborted ? result : undefined;
		} catch {
			return undefined;
		} finally {
			this.reads.delete(control);
		}
	}

	async request(deviceId: string): Promise<{ requestId: string } | undefined> {
		if (this.phase !== 'ready' || !deviceId) return undefined;
		this.phase = 'draining';
		const requestId = randomUUID();
		const expired = () => void this.cancel(requestId);
		const window = {
			requestId,
			deviceId,
			expiresAt: performance.now() + privateWindowMs,
			expiry: setTimeout(expired, privateWindowMs),
			drained: Promise.allSettled(this.reads.values())
		};
		window.expiry.unref();
		this.active = window;
		for (const read of this.reads.keys()) read.abort();
		await window.drained;
		if (this.phase !== 'draining') return undefined;
		if (performance.now() >= window.expiresAt) {
			await this.cancel(requestId);
			return undefined;
		}
		this.phase = 'private';
		return { requestId };
	}

	permitsInput(requestId: string, deviceId: string): boolean {
		return (
			this.phase === 'private' &&
			this.active?.requestId === requestId &&
			this.active.deviceId === deviceId &&
			performance.now() < this.active.expiresAt
		);
	}

	async finish(requestId: string, deviceId: string): Promise<boolean> {
		if (!this.permitsInput(requestId, deviceId) || !this.active) return false;
		return this.end(this.active, true);
	}

	async cancel(requestId: string): Promise<boolean> {
		if (this.active?.requestId !== requestId) return false;
		return this.end(this.active, false);
	}

	private async end(window: PrivateBrowserRequest, verify: boolean): Promise<boolean> {
		this.phase = 'disposing';
		this.active = undefined;
		clearTimeout(window.expiry);
		await window.drained;
		return this.clean(verify);
	}

	private async clean(verify: boolean): Promise<boolean> {
		try {
			await this.cleanup.revokeInput();
			await this.cleanup.disposeForm();
			this.phase = !verify || (await this.cleanup.verifyResult()) ? 'ready' : 'blocked';
		} catch {
			this.phase = 'blocked';
		}
		return this.phase === 'ready';
	}
}
