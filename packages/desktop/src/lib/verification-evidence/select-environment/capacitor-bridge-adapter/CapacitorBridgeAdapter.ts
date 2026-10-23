import type {
	CapacitorBridgeAdapterConfig,
	Operation,
	Input
} from './CapacitorBridgeAdapter.types';
import {
	projectlessMethods,
	revisionMethods
} from '../../../../../../remote/src/models/Remote.types';
import type { DesktopBridge } from '../../../../models/development-tooling/DesktopBridge.types';
import type { ProjectSnapshot } from '../../../../models/development-tooling/Desktop.types';
import type {
	RemoteBinary,
	RemoteMethod,
	RemoteNativeAnswer,
	RemoteNativeStatus,
	RemoteRevision,
	WireChannel
} from '../../../../models/development-tooling/Environment.types';
import { cachedSnapshot } from './cachedSnapshot';
import { remoteArtifact } from './remoteArtifact';
import { remoteBinary } from '../../../../utils/networking-security/remoteBinary';
import { remoteGrant } from './remoteGrant';

const noFolder = 'A phone has no folders to open. Add the project on your computer.';

const noRevision = 'Open the project at its branch tip before changing it.';

const notAttached = 'This operation is not available on this connection.';

const unfinished = 'The computer could not complete this request.';

/** What the plugin rejects with becomes an ordinary error that keeps the code of the computer. */
function failure(cause: unknown): Error {
	const { code, message } = (cause ?? {}) as { code?: string; message?: string };
	return Object.assign(new Error(message || unfinished), { code: code || 'failed' });
}

/**
 * The product interface of a phone: every operation is one named request to the computer.
 * No project is selected on the other side, so each request names its project and each change
 * names the revision the person is looking at. Only what the computer attached is offered, and
 * an answer that is a saved copy is shown as one. Folders and hosted sign-in do not exist here.
 */
export class CapacitorBridgeAdapter {
	private selected: string | null = null;
	private readonly revisions = new Map<string, RemoteRevision>();
	private granted = new Set<string>();
	private principal = '';
	private reached = false;
	constructor(private readonly config: CapacitorBridgeAdapterConfig) {}

	/** Each status of the plugin decides anew what may be asked; before one, nothing may. */
	allow(status: RemoteNativeStatus | null): void {
		this.granted = remoteGrant(status);
		this.principal = status?.device?.id ?? '';
		this.reached = status?.state === 'online';
		if (!this.granted.size) this.revisions.clear();
	}

	connect(): DesktopBridge {
		return Object.defineProperties(this.required(), this.offered());
	}

	/**
	 * Operations the page finds only while the computer allows them. Drafts, permissions and
	 * comments have no saved copy, so they are found only while it is reached; evidence has one.
	 */
	private offered(): PropertyDescriptorMap {
		const when = (method: RemoteMethod, operation: Operation, live = false) => ({
			enumerable: true,
			get: () => (this.granted.has(method) && (this.reached || !live) ? operation : undefined)
		});
		const ask = (method: RemoteMethod, live = false) =>
			when(method, (input) => this.request(method, input), live);
		const select = (input?: object) => this.snapshot({ ...input, branch: null, commit: null });
		const artifact = async (input?: object) =>
			remoteArtifact(await this.request<RemoteBinary>('artifact', input), (input as Input).sha256);
		return {
			listProjects: when('listProjects', () => this.request('listProjects')),
			selectProject: when('snapshot', select),
			capabilities: ask('capabilities', true),
			addComment: ask('addComment', true),
			pendingComments: ask('pendingComments', true),
			history: ask('history'),
			evidence: ask('evidence'),
			artifact: when('artifact', artifact)
		};
	}

	private required(): DesktopBridge {
		const ask = <T>(method: RemoteMethod, input?: object) => this.request<T>(method, input);
		return {
			openProject: () => Promise.reject(new Error(noFolder)),
			snapshot: (input) => this.snapshot(input),
			entity: (input) => ask('entity', input),
			source: (input) => ask('source', input),
			image: async (input) => remoteBinary(await ask<RemoteBinary>('image', input)),
			createPlan: (input) => ask('createPlan', input),
			openThread: (input) => ask('openThread', input),
			messages: (input) => ask('messages', input),
			approve: (input) => ask('approve', input),
			providers: () => ask('providers'),
			startRun: (input) => ask('startRun', input),
			cancelRun: (input) => ask('cancelRun', input),
			onRunEvent: (listener) => this.listen('run', listener as (value: unknown) => void),
			onCacheStatus: (listener) => this.listen('cache', listener as (value: unknown) => void)
		};
	}

	/**
	 * A later change names the revision of the project's latest branch view. A view pinned to a
	 * commit is history, also when that commit is the tip, and a saved copy is no view of the
	 * computer at all: neither names a revision to change.
	 */
	private async snapshot(input: object): Promise<ProjectSnapshot> {
		const answer = await this.send('snapshot', input);
		const live = answer.value as ProjectSnapshot;
		const cachedAt = answer.cachedAt;
		const saved = { cachedAt: cachedAt ?? '', principal: this.principal };
		const snapshot = cachedAt ? cachedSnapshot(live, saved) : live;
		const id = snapshot.project.id ?? (input as Input).projectId ?? null;
		if (!id) return snapshot;
		this.selected = id;
		const { branch, commit, atTip } = snapshot.revision;
		if (cachedAt || (input as Input).commit || !atTip) this.revisions.delete(id);
		else this.revisions.set(id, { branch, commit });
		return snapshot;
	}

	private async request<T>(method: RemoteMethod, input?: object): Promise<T> {
		return (await this.send(method, input)).value as T;
	}

	private async send(method: RemoteMethod, input: object = {}): Promise<RemoteNativeAnswer> {
		if (!this.granted.has(method))
			throw Object.assign(new Error(notAttached), { code: 'method-denied' });
		const body: Input = { ...input };
		if (!projectlessMethods.includes(method)) body.projectId ??= this.selected ?? undefined;
		if (revisionMethods.includes(method)) body.revision = this.revision(body.projectId);
		/** Only plain data crosses the native bridge: no proxy, no undefined. */
		const plain = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
		try {
			return await this.config.plugin.request({ method, input: plain });
		} catch (cause) {
			throw failure(cause);
		}
	}

	private revision(projectId: string | undefined): RemoteRevision {
		const known = projectId ? this.revisions.get(projectId) : undefined;
		if (!known) throw new Error(noRevision);
		return known;
	}

	/** The plugin hands on each event once and in order; here it only finds its channel. */
	private listen(channel: WireChannel, listener: (value: unknown) => void): () => void {
		const handle = this.config.plugin.addListener('event', (event) => {
			if (event.channel === channel) listener(event.value);
		});
		return () => void handle.then((item) => item.remove());
	}
}

export type { CapacitorBridgeAdapterConfig } from './CapacitorBridgeAdapter.types';
