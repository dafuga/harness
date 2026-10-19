import { browserBridge } from '../../../../hub/src/utils/browser-bridge/browserBridge';
import type { BrowserApi, Query } from '../../../../hub/src/utils/browserApi';
import type { DesktopBridge } from '../../models/DesktopBridge.types';
import type {
	AccountNativeCall,
	AccountNativePlugin,
	AccountNativeReply,
	AccountNativeStatus
} from '../../models/Environment.types';
import type {
	CacheStatus,
	DesktopProject,
	NativeHostedStatus
} from '../../models/ProjectContext.types';
import { artifactLimit } from '../../utils/artifactMedia';
import { everyProject } from '../../utils/cache-status/cacheStatus';
import {
	accountIdentity,
	principal,
	decoded,
	failure,
	fields,
	json,
	plain,
	publicStatus,
	refusal,
	refused,
	replyLimit
} from './capacitorAccountCodec';

export interface CapacitorAccountAdapterConfig {
	plugin: AccountNativePlugin;
}
const changed = 'The account on this phone changed. Reload and try again.';
const notMade = 'This request is not made from this phone.';

/**
 * This phone's own Hub account as a product interface. Google sign-in, the session and every
 * credential stay in the native plugin; here each read is one call of the Hub's project API
 * through it. Shared reads, comments, evidence and agent polling are the hosted page's own
 * `browserBridge`. Nothing is kept for offline use: this lane needs a reachable Hub, and a change
 * without one is refused, never saved for later.
 */
export class CapacitorAccountAdapter {
	/** Counts every change of account; an answer asked for before one is not used. */
	private generation = 0;
	private known: NativeHostedStatus | null = null;
	private listeners = new Set<(event: CacheStatus) => void>();
	constructor(private readonly config: CapacitorAccountAdapterConfig) {}

	connect(): DesktopBridge {
		const shared = browserBridge(this.api());
		return {
			...shared,
			onCacheStatus: (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			},
			listProjects: () => this.listProjects(shared),
			hostedStatus: () => this.account(() => this.config.plugin.status()),
			connectHosted: () => this.account(() => this.config.plugin.connect()),
			disconnectHosted: () => this.disconnect()
		};
	}

	/** Owned and invited projects while signed in; none otherwise, and none of an earlier account. */
	private async listProjects(shared: DesktopBridge): Promise<DesktopProject[]> {
		const known = this.known ?? (await this.account(() => this.config.plugin.status()));
		if (known.state !== 'signed-in') return [];
		const asked = this.generation;
		try {
			const listed = await shared.listProjects!();
			return asked === this.generation ? listed : [];
		} catch (cause) {
			if ((cause as { status?: number }).status === 401) return [];
			throw cause;
		}
	}

	/** Each status is the last one known; another person or state starts a new generation. */
	private async account(ask: () => Promise<AccountNativeStatus>): Promise<NativeHostedStatus> {
		const asked = this.generation;
		let status: NativeHostedStatus;
		try {
			status = publicStatus(await ask());
		} catch (cause) {
			if (asked !== this.generation) return this.known!;
			const error = refusal(cause);
			if (error.status !== 401) throw error;
			this.ended();
			return this.known!;
		}
		if (asked !== this.generation) return this.known ?? status;
		const known = this.known;
		const before = principal(known);
		if (accountIdentity(status) !== accountIdentity(known)) this.generation++;
		this.known = status;
		if (before !== null && before !== principal(status)) this.denied();
		return status;
	}

	/** The page forgets the account before the plugin ends it, so nothing more is listed for it. */
	private disconnect(): Promise<NativeHostedStatus> {
		this.ended();
		return this.account(() => this.config.plugin.disconnect());
	}

	private ended(): void {
		this.generation++;
		this.known = { configured: this.known?.configured ?? true, state: 'signed-out' };
		this.denied();
	}

	private denied(projectId = everyProject): void {
		this.listeners.forEach((listener) => listener({ projectId, status: 'denied' }));
	}

	/** The API of the shared reads over the plugin: the same paths, no origin and no credential. */
	private api(): BrowserApi {
		const read = (path: string, query?: Query) =>
			this.send({ method: 'GET', path, query: fields(query) });
		return {
			get: async <T>(path: string, query?: Query) => json<T>(await read(path, query)),
			send: async <T>(method: 'POST' | 'DELETE', path: string, body?: unknown) => {
				if (method !== 'POST') throw failure(400, 'request-refused', notMade);
				return json<T>(await this.send({ method, path, body: plain(body) }));
			},
			media: async (path: string, query?: Query) => {
				const reply = await read(path, query);
				return { bytes: decoded(reply.data, artifactLimit), mediaType: String(reply.contentType) };
			},
			bytes: async (path: string, query?: Query) =>
				decoded((await read(path, query)).data, replyLimit)
		};
	}

	/** One call through the plugin. A refusal of the Hub is an error with its status, as in a browser. */
	private async send(call: AccountNativeCall): Promise<AccountNativeReply> {
		const asked = this.generation;
		let reply: AccountNativeReply;
		try {
			reply = await this.config.plugin.request(call);
		} catch (cause) {
			const error = refusal(cause);
			if (asked === this.generation && error.status === 401) this.ended();
			throw error;
		}
		if (asked !== this.generation) throw failure(401, 'superseded', changed);
		if (reply.status === 401) this.ended();
		if (reply.status === 403) this.denied(/^\/api\/projects\/([^/]+)/.exec(call.path)?.[1]);
		if (reply.status >= 200 && reply.status < 300) return reply;
		throw refused(reply);
	}
}
