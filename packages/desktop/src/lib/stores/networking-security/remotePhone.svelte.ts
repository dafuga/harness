import type { State } from './remotePhone.svelte.types';
import type { Workspace } from '../projects-sessions/workspace.svelte';
import type {
	RemoteMobileControl,
	RemoteMobileStatus,
	RemoteNativeStatus
} from '../../../models/development-tooling/Environment.types';
import { cacheStatus } from '../../../utils/projects-sessions/cache-status/cacheStatus';
import { accountView, forgetRemote } from '../../../utils/networking-security/forgetRemote';
import {
	authorityChange,
	excludes,
	noAuthority,
	remoteAuthority
} from '../../../utils/networking-security/remoteAuthority';
import {
	nameNotice,
	phoneName,
	scanFailure,
	scanNotice
} from '../../../utils/development-tooling/scan-notice/scanNotice';
import type { ScanFailure } from '../../../utils/development-tooling/scan-notice/scanNotice';
import { isWorkspacePath } from '../../../utils/projects-sessions/workspaceRoute';
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
	/** How the last scan ended without an offer, while that is what the page says; or null. */
	scanFailure = $state<ScanFailure | null>(null);
	private kept = false;
	private release: (() => void) | undefined;
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
		await this.ask(() => port.status());
	}
	/** Whatever is still under way is not shown when it answers. */
	dispose() {
		this.version++;
		this.release?.();
		this.release = undefined;
	}
	/**
	 * Opens the scanner of the phone under this name. The page hands over nothing else and is
	 * handed no offer: the plugin reads the code, checks it and asks the computer by itself.
	 */
	async scan(name: string) {
		const deviceName = phoneName(name);
		this.scanFailure = null;
		if (!deviceName) {
			this.error = nameNotice;
			return false;
		}
		return this.ask((port) => port.scan({ deviceName }));
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
		this.scanFailure = null;
		const asked = this.version;
		try {
			const status = await call(port);
			/** A state announced meanwhile is newer than this answer. */
			if (asked === this.version) this.accept(status);
			return true;
		} catch (cause) {
			this.scanFailure = scanFailure(cause);
			this.error = scanNotice(cause);
			return false;
		} finally {
			this.busy = false;
		}
	}
	private accept(status: RemoteMobileStatus) {
		const before = this.status;
		this.version++;
		this.status = status;
		if (away.includes(status.state)) return this.lost(status);
		this.kept = false;
		if (status.state === 'online') return this.reached(before, status);
		/** Not paired, or no longer: nothing of a computer stays; the phone's own account is listed anew. */
		this.authority = noAuthority;
		if (forgetRemote(this.workspace)) void this.workspace.loadProjects();
	}
	/** What a new authority excludes leaves first; only then is anything read, and read anew. */
	private reached(before: RemoteMobileStatus | null, status: RemoteMobileStatus) {
		const workspace = this.workspace;
		const next = remoteAuthority(status);
		const change = authorityChange(this.authority, next, before?.state === 'online');
		this.authority = next;
		if (change === 'none') return;
		/** A project of the phone's own account was granted by no computer: no grant narrows it. */
		if (accountView(workspace)) return this.beside(change === 'holder');
		const allowed = workspace.capabilities;
		if (change === 'holder' || excludes(status, workspace.projectId)) forgetRemote(workspace);
		else if (!status.grant?.agents)
			workspace.capabilities = { ...allowed, agents: false, planning: false, approval: false };
		void workspace.loadProjects();
		if (workspace.snapshot || isWorkspacePath(path())) void workspace.refresh();
	}
	private beside(holder: boolean) {
		if (holder) forgetRemote(this.workspace);
		void this.workspace.loadProjects();
	}
	/**
	 * What is on the page stays readable, named as a cached copy; nothing can be changed. Where
	 * nothing is shown yet, what the phone kept of this computer is read once, as saved copies.
	 */
	private lost(status: RemoteMobileStatus) {
		const workspace = this.workspace;
		const projectId = workspace.projectId;
		const cachedAt = status.lastOnlineAt ?? undefined;
		/** A project of the phone's own account is no copy of this computer, and stays as it is. */
		const own = accountView(workspace);
		if (workspace.snapshot && projectId !== null && !own)
			return cacheStatus(workspace, { projectId, status: 'offline', cachedAt });
		if (status.state !== 'offline' || this.kept) return;
		this.kept = true;
		void workspace.loadProjects();
		if (!own && isWorkspacePath(path())) void workspace.refresh();
	}
}
export function createRemotePhoneStore(workspace: Workspace) {
	return new RemotePhoneState(workspace);
}

export type { RemotePhone } from './remotePhone.svelte.types';
export type { RemotePhoneState };
