import type { Workspace } from './workspace.svelte';
import type {
	RemoteMobileControl,
	RemoteMobileStatus,
	RemoteNativeStatus
} from '../../models/Environment.types';
import { cacheStatus } from '../../utils/cacheStatus';
import { forgetRemote } from '../../utils/forgetRemote';
import { pairingInput, pairingTarget, type PairingFields } from '../../utils/pairingInput';
import {
	authorityChange,
	excludes,
	noAuthority,
	remoteAuthority
} from '../../utils/remoteAuthority';
import { isWorkspacePath } from '../../utils/workspaceRoute';

type State = RemoteMobileStatus['state'];
/** Paired, but the computer cannot be asked right now. */
const away: State[] = ['offline', 'connecting'];
function path() {
	return globalThis.location?.pathname ?? '/';
}

/**
 * This phone's connection to a computer. The native plugin owns the socket, the keys and the
 * credential; the page learns a state and acts on it at once: what a new authority excludes
 * leaves the page before anything else, a lost computer leaves a cached copy that is named as
 * one, and an answer that is older than the last announced state is never shown.
 */
class RemotePhoneState {
	status = $state<RemoteMobileStatus | null>(null);
	error = $state('');
	busy = $state(false);
	/** A pairing link the phone was opened with, while nothing is paired; it holds no code. */
	offered = $state('');
	private waiting = '';
	private kept = false;
	private release: (() => void) | undefined;
	private unlink: (() => void) | undefined;
	/** Counts every accepted state and every end; an answer asked for before it is stale. */
	private version = 0;
	/** The identity and the grant under which what is on the page was read. */
	private authority = noAuthority;
	constructor(private workspace: Workspace) {}
	/** True only where the plugin says it is a Debug build started for a local test fixture. */
	get fixture(): boolean {
		return (this.status as RemoteNativeStatus | null)?.fixture === true;
	}
	get port(): RemoteMobileControl | undefined {
		return this.workspace.remote.phone;
	}
	/** Asks once and then listens: approval, loss and revocation are announced natively. */
	async start() {
		const port = this.port;
		if (!port || this.release) return;
		this.release = port.onStatus((status) => this.accept(status));
		this.unlink = this.workspace.remote.links?.onPairingLink((link) => this.offer(link));
		await this.ask(() => port.status());
	}
	/** Whatever is still under way is not shown when it answers. */
	dispose() {
		this.version++;
		this.release?.();
		this.unlink?.();
		this.release = this.unlink = undefined;
	}
	/** Only a real link is kept, and only for a phone that is not paired; it may come early. */
	private offer(link: string) {
		if (!pairingTarget(link, this.fixture)) return;
		if (!this.status) this.waiting = link;
		else if (this.status.state === 'unpaired') this.offered = link;
	}
	/** Nothing reaches the plugin unless the link, the code and the name are all well-formed. */
	async pair(fields: PairingFields) {
		const parsed = pairingInput(fields, this.fixture);
		if ('error' in parsed) {
			this.error = parsed.error;
			return false;
		}
		return this.ask((port) => port.pair(parsed.input));
	}
	/** Forgets the computer; the plugin deletes the credential and keys it held for it. */
	disconnect() {
		return this.ask((port) => port.disconnect());
	}
	private async ask(call: (port: RemoteMobileControl) => Promise<RemoteMobileStatus>) {
		const port = this.port;
		if (!port || this.busy) return false;
		this.busy = true;
		this.error = '';
		const asked = this.version;
		try {
			const status = await call(port);
			/** A state announced meanwhile is newer than this answer. */
			if (asked === this.version) this.accept(status);
			return true;
		} catch (cause) {
			this.error = String(cause);
			return false;
		} finally {
			this.busy = false;
		}
	}
	private accept(status: RemoteMobileStatus) {
		const before = this.status;
		this.version++;
		this.status = status;
		this.offered = status.state === 'unpaired' ? this.offered || this.waiting : '';
		this.waiting = '';
		if (away.includes(status.state)) return this.lost(status);
		this.kept = false;
		if (status.state === 'online') return this.reached(before, status);
		/** Not paired, or no longer: nothing of a computer stays, nor any read still under way. */
		this.authority = noAuthority;
		forgetRemote(this.workspace);
	}
	/** What a new authority excludes leaves first; only then is anything read, and read anew. */
	private reached(before: RemoteMobileStatus | null, status: RemoteMobileStatus) {
		const workspace = this.workspace;
		const next = remoteAuthority(status);
		const change = authorityChange(this.authority, next, before?.state === 'online');
		this.authority = next;
		if (change === 'none') return;
		const allowed = workspace.capabilities;
		if (change === 'holder' || excludes(status, workspace.projectId)) forgetRemote(workspace);
		else if (!status.grant?.agents)
			workspace.capabilities = { ...allowed, agents: false, planning: false, approval: false };
		void workspace.loadProjects();
		if (workspace.snapshot || isWorkspacePath(path())) void workspace.refresh();
	}
	/**
	 * What is on the page stays readable, named as a cached copy; nothing can be changed. Where
	 * nothing is shown yet, what the phone kept of this computer is read once, as saved copies.
	 */
	private lost(status: RemoteMobileStatus) {
		const workspace = this.workspace;
		const projectId = workspace.projectId;
		const cachedAt = status.lastOnlineAt ?? undefined;
		if (workspace.snapshot && projectId !== null)
			return cacheStatus(workspace, { projectId, status: 'offline', cachedAt });
		if (status.state !== 'offline' || this.kept) return;
		this.kept = true;
		void workspace.loadProjects();
		if (isWorkspacePath(path())) void workspace.refresh();
	}
}
export function createRemotePhoneStore(workspace: Workspace) {
	return new RemotePhoneState(workspace);
}
export type RemotePhone = RemotePhoneState;
