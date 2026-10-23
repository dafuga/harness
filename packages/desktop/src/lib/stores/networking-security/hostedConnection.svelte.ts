import type { Workspace } from '../projects-sessions/workspace.svelte';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { NativeHostedStatus } from '../../../models/projects-sessions/ProjectContext.types';
import { ProjectSyncService } from '../../../services/projects-sessions/ProjectSyncService';
import {
	everyProject,
	forgetShared
} from '../../../utils/projects-sessions/cache-status/cacheStatus';
import { hostedAddress } from '../../../utils/development-tooling/hostedAddress';

/**
 * This device's connection to the hosted projects. The main process owns the origin, the
 * verifier and the session; the page sees a code to type and an address to open, nothing more.
 * While signed in, the status and the owned and joined projects are read again on focus, when
 * shown, when back online and every half minute.
 */
class HostedConnectionState {
	status = $state<NativeHostedStatus | null>(null);
	error = $state('');
	busy = $state(false);
	private timer: ReturnType<typeof setTimeout> | undefined;
	private disposed = false;
	private sync = new ProjectSyncService({ refresh: () => this.load() });
	constructor(private workspace: Workspace) {}
	/** Only a bridge with all three operations connects; a hosted page or an older app cannot. */
	get available() {
		const bridge = this.workspace.bridge;
		return Boolean(bridge?.hostedStatus && bridge.connectHosted && bridge.disconnectHosted);
	}
	get address() {
		return hostedAddress(this.status?.handoff?.verificationUrl);
	}
	get expired() {
		const until = Date.parse(this.status?.handoff?.expiresAt ?? '');
		return this.status?.state === 'pending' && !(until > Date.now());
	}
	load() {
		return this.ask((bridge) => bridge.hostedStatus!());
	}
	connect() {
		return this.ask((bridge) => bridge.connectHosted!());
	}
	/** What was private leaves the page first; the bridge then ends the session. */
	disconnect() {
		this.forget();
		return this.ask((bridge) => bridge.disconnectHosted!());
	}
	/** Nothing is asked after this, and an answer still under way is not taken. */
	dispose() {
		this.disposed = true;
		this.wait(null);
		this.sync.stop();
	}
	private async ask(call: (bridge: DesktopBridge) => Promise<NativeHostedStatus>) {
		if (!this.available || this.busy || this.disposed) return;
		this.busy = true;
		this.error = '';
		let status: NativeHostedStatus | undefined;
		try {
			status = await call(this.workspace.bridge!);
		} catch (cause) {
			if (!this.disposed) this.error = String(cause);
		} finally {
			this.busy = false;
		}
		if (status && !this.disposed) await this.accept(status);
	}
	/**
	 * Another account, or none, takes what was shared off the page before anything is listed.
	 * Signed in, the projects are listed after every status; otherwise when the state changes.
	 */
	private async accept(status: NativeHostedStatus) {
		const before = this.status;
		this.status = status;
		const holder = principal(before);
		if (holder !== null && holder !== principal(status)) this.forget();
		const signedIn = status.state === 'signed-in';
		if (signedIn) this.sync.start();
		else this.sync.stop();
		this.wait(status);
		if (signedIn || (status.state !== 'pending' && status.state !== before?.state))
			await this.workspace.loadProjects();
	}
	/** While approval is pending the status is asked again no sooner than the server's interval. */
	private wait(status: NativeHostedStatus | null) {
		clearTimeout(this.timer);
		this.timer = undefined;
		const wait = Math.max(1, status?.handoff?.interval ?? 0) * 1000;
		if (status?.state === 'pending' && status.handoff && !this.expired)
			this.timer = setTimeout(() => void this.load(), wait);
	}
	/** A listing or a read under way for the account that is left is not shown when it answers. */
	private forget() {
		this.workspace.invalidate();
		forgetShared(this.workspace, everyProject, '');
	}
}
/** The account the main process says is signed in; null while nobody is. */
function principal(status: NativeHostedStatus | null) {
	return status?.state === 'signed-in' ? (status.actor?.id ?? '') : null;
}
export function createHostedConnectionStore(workspace: Workspace) {
	return new HostedConnectionState(workspace);
}

export type { HostedConnection } from './hostedConnection.svelte.types';
export type { HostedConnectionState };
