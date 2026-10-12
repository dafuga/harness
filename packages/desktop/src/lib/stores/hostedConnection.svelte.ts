import type { Workspace } from './workspace.svelte';
import type { DesktopBridge } from '../../models/DesktopBridge.types';
import type { NativeHostedStatus } from '../../models/ProjectContext.types';
import { everyProject, forgetShared } from '../../utils/cacheStatus';
import { hostedAddress } from '../../utils/hostedAddress';

/**
 * This device's connection to the hosted projects. The main process owns the origin, the
 * verifier and the session; the page sees a code to type and an address to open, nothing more.
 */
class HostedConnectionState {
	status = $state<NativeHostedStatus | null>(null);
	error = $state('');
	busy = $state(false);
	private timer: ReturnType<typeof setTimeout> | undefined;
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
		forgetShared(this.workspace, everyProject, '');
		return this.ask((bridge) => bridge.disconnectHosted!());
	}
	dispose() {
		clearTimeout(this.timer);
		this.timer = undefined;
	}
	private async ask(call: (bridge: DesktopBridge) => Promise<NativeHostedStatus>) {
		if (!this.available || this.busy) return;
		this.busy = true;
		this.error = '';
		try {
			this.accept(await call(this.workspace.bridge!));
		} catch (cause) {
			this.error = String(cause);
		} finally {
			this.busy = false;
		}
	}
	/** While approval is pending the status is asked again no sooner than the server's interval. */
	private accept(status: NativeHostedStatus) {
		const before = this.status?.state;
		this.status = status;
		this.dispose();
		const wait = Math.max(1, status.handoff?.interval ?? 0) * 1000;
		if (status.state === 'pending' && status.handoff && !this.expired)
			this.timer = setTimeout(() => void this.load(), wait);
		if (status.state !== 'pending' && status.state !== before) void this.workspace.loadProjects();
	}
}
export function createHostedConnectionStore(workspace: Workspace) {
	return new HostedConnectionState(workspace);
}
export type HostedConnection = HostedConnectionState;
