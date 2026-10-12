import type { Workspace } from './workspace.svelte';
import type { RemoteDesktopControl, RemoteHostStatus } from '../../models/Environment.types';

type Approval = Parameters<RemoteDesktopControl['approvePairing']>[0];

/**
 * Phone access to this computer, as the desktop control port reports it: public metadata only.
 * The main process owns the relay socket, the keys and every credential; the page sees a code to
 * read out, who asks, and who was approved for what.
 */
class RemoteHostState {
	status = $state<RemoteHostStatus | null>(null);
	error = $state('');
	busy = $state(false);
	private release: (() => void) | undefined;
	/** Counts every accepted status and every end; an answer asked for before it is stale. */
	private version = 0;
	constructor(private workspace: Workspace) {}
	get port(): RemoteDesktopControl | undefined {
		return this.workspace.remote.host;
	}
	/** Asks once and then listens: a phone that asks or leaves is announced by the main process. */
	async start() {
		const port = this.port;
		if (!port || this.release) return;
		this.release = port.onStatus((status) => this.accept(status));
		await this.ask(() => port.status());
	}
	dispose() {
		this.version++;
		this.release?.();
		this.release = undefined;
	}
	enable() {
		return this.ask((port) => port.enable());
	}
	disable() {
		return this.ask((port) => port.disable());
	}
	/** The offer is part of the status; it is read again in case no event announced it. */
	createPairing() {
		return this.ask(async (port) => {
			await port.createPairing();
			return port.status();
		});
	}
	/** A grant is exactly what was chosen: these projects, and agents only when stated. */
	approve(input: Approval) {
		return this.ask((port) => port.approvePairing(input));
	}
	deny(pairingId: string) {
		return this.ask((port) => port.denyPairing({ pairingId }));
	}
	revoke(deviceId: string) {
		return this.ask((port) => port.revokeDevice({ deviceId }));
	}
	private async ask(call: (port: RemoteDesktopControl) => Promise<RemoteHostStatus>) {
		const port = this.port;
		if (!port || this.busy) return false;
		this.busy = true;
		this.error = '';
		const asked = this.version;
		try {
			const status = await call(port);
			/** A status announced meanwhile is newer than this answer. */
			if (asked === this.version) this.accept(status);
			return true;
		} catch (cause) {
			this.error = String(cause);
			return false;
		} finally {
			this.busy = false;
		}
	}
	private accept(status: RemoteHostStatus) {
		this.version++;
		this.status = status;
	}
}
export function createRemoteHostStore(workspace: Workspace) {
	return new RemoteHostState(workspace);
}
export type RemoteHost = RemoteHostState;
