// @harness-uid u_pwotvhqpjv
import type {
	ScopeKeys,
	SealedChainState
} from '../../../../remote/src/models/networking-security/Sealed.types';
import { SealedBrowserCache } from './SealedBrowserCache';
import type { SealedEnrollment } from './SealedBrowserCache.types';
import type { SealedHomeCallbacks } from './SealedHomeService.types';
import { SealedLive } from './SealedLive';
import { refreshSealedEnrollment, sealedReader, syncSealedObjects } from './sealedDelta';
import { committedKeys, verifiedEnrollment } from './sealedEnrollment';
import { sealedSessions } from './sealedSessions';

const refreshMs = 15_000;

/** Home reads the approved account's local records before beginning any network operation. */
export class SealedHomeService {
	private cache: SealedBrowserCache | undefined;
	private enrollment: SealedEnrollment | undefined;
	private chain: SealedChainState | undefined;
	private socket: SealedLive | undefined;
	private subscribed = '';
	private cancel = new AbortController();
	private timer: ReturnType<typeof setInterval> | undefined;
	private refreshing = false;
	private more = false;

	constructor(
		private readonly account: string,
		private readonly show: SealedHomeCallbacks
	) {}

	async start(): Promise<void> {
		const cache = await SealedBrowserCache.open(this.account);
		if (this.cancel.signal.aborted) return cache.close();
		this.cache = cache;
		const enrollment = await cache.enrollment();
		if (!enrollment || this.cancel.signal.aborted) return;
		this.enrollment = enrollment;
		this.chain = await verifiedEnrollment(this.account, enrollment);
		await this.publishCached();
		if (this.cancel.signal.aborted) return;
		this.refresh();
		this.timer = setInterval(this.refresh, refreshMs);
		document.addEventListener('visibilitychange', this.refresh);
		window.addEventListener('online', this.refresh);
	}

	close(): void {
		this.cancel.abort();
		clearInterval(this.timer);
		document.removeEventListener('visibilitychange', this.refresh);
		window.removeEventListener('online', this.refresh);
		this.socket?.close();
		this.cache?.close();
	}

	private refresh = (): void => {
		if (this.cancel.signal.aborted || document.visibilityState === 'hidden') return;
		if (this.refreshing) {
			this.more = true;
			return;
		}
		this.refreshing = true;
		void this.catchUp()
			.catch(() => {
				// Keep the authenticated offline view while the network is unavailable.
			})
			.finally(() => {
				this.refreshing = false;
				if (!this.more) return;
				this.more = false;
				this.refresh();
			});
	};

	private async catchUp(): Promise<void> {
		const { cache, enrollment, chain } = this;
		if (!cache || !enrollment || !chain) return;
		const read = sealedReader(enrollment.deviceId, this.cancel.signal);
		const fresh = await refreshSealedEnrollment(read, cache, enrollment, chain);
		this.enrollment = fresh.enrollment;
		this.chain = fresh.chain;
		if (this.cancel.signal.aborted) return;
		const scopes = this.scopes();
		this.subscribe(scopes, enrollment.deviceId);
		if (fresh.chain !== chain || fresh.keysChanged) await this.publishCached();
		const changed = await Promise.all(
			scopes.map((scope) => syncScope(read, cache, scope, (epoch) => this.readKeys(scope, epoch)))
		);
		if (changed.some(Boolean)) await this.publishCached();
	}

	private subscribe(scopes: string[], device: string): void {
		const identity = JSON.stringify([device, scopes]);
		if (identity === this.subscribed) return;
		this.subscribed = identity;
		this.socket?.close();
		if (!scopes.length) return;
		this.socket = new SealedLive({
			device,
			scopes,
			readKeys: (scope, epoch) => this.readKeys(scope, epoch),
			onObjects: this.refresh,
			onOutput: this.show.output
		});
		this.socket.connect();
	}

	private scopes(): string[] {
		const chain = this.chain;
		const self = chain?.devices[this.enrollment?.deviceId ?? ''];
		if (!chain || !self?.active) return [];
		return self.scopes.filter((scope) => !chain.scopes[scope]?.stale);
	}

	private async readKeys(scope: string, epoch: number) {
		const keys = await this.cache?.keys(scope, epoch);
		const commitment = this.chain?.scopes[scope]?.commitments[epoch];
		return committedKeys(keys, commitment) && this.scopes().includes(scope) ? keys : undefined;
	}

	private async publishCached(): Promise<void> {
		const cache = this.cache;
		if (!cache || this.cancel.signal.aborted) return;
		const groups = await Promise.all(
			this.scopes().map((scope) =>
				readScopeSessions(cache, scope, (epoch) => this.readKeys(scope, epoch))
			)
		);
		if (!this.cancel.signal.aborted) this.show.sessions(groups.flat());
	}
}

async function readScopeSessions(
	cache: SealedBrowserCache,
	scope: string,
	readKeys: (epoch: number) => Promise<ScopeKeys | undefined>
) {
	const keysByEpoch = new Map<number, ReturnType<typeof readKeys>>();
	return sealedSessions(scope, await cache.objects(scope), (epoch) => {
		const requested = keysByEpoch.get(epoch) ?? readKeys(epoch);
		keysByEpoch.set(epoch, requested);
		return requested;
	});
}

async function syncScope(
	read: ReturnType<typeof sealedReader>,
	cache: SealedBrowserCache,
	scope: string,
	readKeys: (epoch: number) => Promise<ScopeKeys | undefined>
) {
	const before = await cache.cursor(scope);
	await syncSealedObjects(read, cache, scope, readKeys).catch(() => {});
	return (await cache.cursor(scope)) > before;
}
