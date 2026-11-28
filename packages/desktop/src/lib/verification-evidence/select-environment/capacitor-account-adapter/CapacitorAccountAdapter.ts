// @harness-uid u_djg3cju4tr
import type { CapacitorAccountAdapterConfig } from './CapacitorAccountAdapter.types';
import { browserBridge } from '../../../../adapters/explorer-ui/browser-project-adapter/browserBridge';
import type { BrowserApi, Query } from '../../../../models/development-tooling/BrowserApi.types';
import type { DesktopBridge } from '../../../../models/development-tooling/DesktopBridge.types';
import type {
	AccountNativeCall,
	AccountNativeReply,
	AccountNativeStatus
} from '../../../../models/development-tooling/Environment.types';
import type {
	CacheStatus,
	DesktopProject,
	NativeHostedStatus
} from '../../../../models/projects-sessions/ProjectContext.types';
import { artifactLimit } from '../../../../utils/reports-media/artifactMedia';
import { everyProject } from '../../../../utils/projects-sessions/cache-status/cacheStatus';
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
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import { homeOutgoingPath } from '$reports/components/projects-sessions/hub-home/hubHomeOutgoingDraft';
import type { HomeOutgoingSource } from '$reports/components/projects-sessions/hub-home/hubHomeOutgoingDraft.types';

const changed = 'The account on this phone changed. Reload and try again.';
const notMade = 'This request is not made from this phone.';
const overviewPath = '/api/tracker-overview';
const unavailableOverview: OverviewSnapshot = { status: 'unavailable' };
/** The Hub's answers that deny this account the overview: not signed in, not the owner, or not found. */
const denying = [401, 403, 404];

/** Only a complete overview is shown; any other answer reads as unavailable, with no rows. */
function readableOverview(value: unknown): OverviewSnapshot {
	const snapshot = value as { status?: unknown; projects?: unknown; machines?: unknown } | null;
	if (snapshot?.status !== 'ready' || !Array.isArray(snapshot.projects)) return unavailableOverview;
	if (!Array.isArray(snapshot.machines)) return unavailableOverview;
	return snapshot as OverviewSnapshot;
}

function deniedBy(cause: unknown): boolean {
	const status = (cause as { status?: unknown } | null)?.status;
	return typeof status === 'number' && denying.includes(status);
}

/** A 403 of a project path clears those projects; the overview's own 403 only withdraws its offer. */
function projectDenied(call: AccountNativeCall, status: number): boolean {
	return (
		status === 403 && (call.path === '/api/projects' || call.path.startsWith('/api/projects/'))
	);
}

/** The API of the shared reads over the plugin: the same paths, no origin and no credential. */
function browserApiOf(send: (call: AccountNativeCall) => Promise<AccountNativeReply>): BrowserApi {
	const read = (path: string, query?: Query) => send({ method: 'GET', path, query: fields(query) });
	return {
		get: async <T>(path: string, query?: Query) => json<T>(await read(path, query)),
		send: async <T>(method: 'POST' | 'DELETE', path: string, body?: unknown) => {
			if (method !== 'POST') throw failure(400, 'request-refused', notMade);
			return json<T>(await send({ method, path, body: plain(body) }));
		},
		media: async (path: string, query?: Query) => {
			const reply = await read(path, query);
			return { bytes: decoded(reply.data, artifactLimit), mediaType: String(reply.contentType) };
		},
		bytes: async (path: string, query?: Query) =>
			decoded((await read(path, query)).data, replyLimit)
	};
}

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
	/** The generation in which the Hub denied the overview; the offer stays withdrawn until the account changes. */
	private refusedAt: number | null = null;
	constructor(private readonly config: CapacitorAccountAdapterConfig) {}

	/** Owner review uses the phone’s Hub account, independently of its paired computer. */
	readonly outgoing: HomeOutgoingSource = {
		read: async () => json(await this.send({ method: 'GET', path: homeOutgoingPath })),
		write: async (body) => json(await this.send({ method: 'POST', path: homeOutgoingPath, body }))
	};

	connect(): DesktopBridge {
		const shared = browserBridge(browserApiOf((call) => this.send(call)));
		const bridge: DesktopBridge = {
			...shared,
			onCacheStatus: (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			},
			listProjects: () => this.listProjects(shared),
			hostedStatus: () => this.account(() => this.config.plugin.status()),
			connectHosted: (input) => this.account(() => this.config.plugin.connect(input)),
			disconnectHosted: () => this.disconnect()
		};
		return Object.defineProperty(bridge, 'projectOverview', {
			enumerable: true,
			get: () =>
				this.known?.state === 'signed-in' && this.refusedAt !== this.generation
					? () => this.overview()
					: undefined
		});
	}

	/**
	 * The owner's overview: one fixed GET with no query, body or credential of its own. A refusal,
	 * an expired or switched account, or an answer this app cannot read is unavailable, with no rows.
	 * A denial of this account withdraws the offer; an answer for an earlier account is discarded.
	 */
	private async overview(): Promise<OverviewSnapshot> {
		const asked = this.generation;
		try {
			return readableOverview(
				json<unknown>(await this.send({ method: 'GET', path: overviewPath }))
			);
		} catch (cause) {
			if (asked === this.generation && deniedBy(cause)) this.refusedAt = asked;
			return unavailableOverview;
		}
	}

	/** Current shared projects for this account when the Hub offers collaboration. */
	private async listProjects(shared: DesktopBridge): Promise<DesktopProject[]> {
		const known = this.known ?? (await this.account(() => this.config.plugin.status()));
		if (known.state !== 'signed-in') return [];
		const asked = this.generation;
		try {
			const listed = await shared.listProjects!();
			return asked === this.generation ? listed : [];
		} catch (cause) {
			const { status, code } = (cause ?? {}) as { status?: number; code?: string };
			if (status === 401 || (status === 503 && code === 'collaboration-disabled')) return [];
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
		if (projectDenied(call, reply.status))
			this.denied(/^\/api\/projects\/([^/]+)/.exec(call.path)?.[1]);
		if (reply.status >= 200 && reply.status < 300) return reply;
		throw refused(reply);
	}
}

export type { CapacitorAccountAdapterConfig } from './CapacitorAccountAdapter.types';
