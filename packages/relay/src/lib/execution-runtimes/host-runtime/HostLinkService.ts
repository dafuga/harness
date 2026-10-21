import type { RelayHostFrame, RelayNotice } from '../../../../../remote/src/index';
import type { HostSocketsAdapter } from './HostSocketsAdapter';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostRecord } from '../../../models/networking-security/RelayHost.types';

/** What the two sides of a host object are told about each other. Nothing is ever queued. */
export class HostLinkService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly sockets: HostSocketsAdapter
	) {}

	/** Sends a frame to the host. False when no host socket is open. */
	toHost(frame: RelayHostFrame): boolean {
		const host = this.sockets.host();
		return host ? this.sockets.send(host, frame) : false;
	}

	/** Tells every connected device that the host came or went. */
	notify(event: RelayNotice['event']): void {
		const notice: RelayNotice = { type: 'relay', event };
		for (const socket of this.sockets.devices()) this.sockets.send(socket, notice);
	}

	/**
	 * Ends a socket, whoever started the close, and tells the other side exactly once: devices
	 * learn that the host went offline, the host learns which connection closed.
	 */
	drop(socket: WebSocket, code: number): void {
		const attachment = this.sockets.attachment(socket);
		this.sockets.close(socket, code);
		if (!attachment || attachment.closed) return;
		if (attachment.role === 'device') {
			this.seen(attachment.deviceId);
			const { deviceId, connectionId } = attachment;
			this.toHost({ type: 'device-close', deviceId, connectionId });
		} else if (!this.sockets.host()) {
			this.notify('host-offline');
		}
	}

	/**
	 * What a host is told when its socket opens: its devices, then every connection that is open,
	 * then every pairing request that still waits for it. The devices are told it is back.
	 */
	welcome(socket: WebSocket, host: HostRecord): void {
		const devices = this.store.devices().map(({ deviceId }) => ({
			deviceId,
			online: this.sockets.device(deviceId).length > 0
		}));
		this.sockets.send(socket, { type: 'ready', hostId: host.hostId, devices });
		for (const frame of [...this.connections(), ...this.requests()])
			this.sockets.send(socket, frame);
		this.notify('host-online');
	}

	/** Records that a device was connected just now. */
	seen(deviceId: string): void {
		const device = this.store.device(deviceId);
		if (device) this.store.saveDevice({ ...device, lastSeenAt: new Date().toISOString() });
	}

	private connections(): RelayHostFrame[] {
		return this.sockets.devices().flatMap((socket): RelayHostFrame[] => {
			const attachment = this.sockets.attachment(socket);
			if (attachment?.role !== 'device') return [];
			const { deviceId, connectionId } = attachment;
			return [{ type: 'device-open', deviceId, connectionId }];
		});
	}

	private requests(): RelayHostFrame[] {
		const now = Date.now();
		return this.store.pairings().flatMap((pairing): RelayHostFrame[] => {
			const { pairingId, request, challenge } = pairing;
			const waiting = pairing.state === 'requested' && pairing.expiresAt > now;
			if (!waiting || !request || !challenge) return [];
			return [{ type: 'pairing-request', pairingId, ...request, challenge }];
		});
	}
}
