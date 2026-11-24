// @harness-uid u_kcfdbqf67h
import { relayCloseCodes } from '../../../../../remote/src/index';
import type { HostSocketsAdapter } from './HostSocketsAdapter';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostLinkService } from './HostLinkService';

/** Ends a device, for the host (`device-revoke`) and for the owner (`/manage/revoke-device`). */
export class DeviceRevocationService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly sockets: HostSocketsAdapter,
		private readonly link: HostLinkService
	) {}

	/**
	 * Deletes the hash of the credential first, so that nothing can connect with it any more,
	 * and an approval the device has not exchanged yet. Then its sockets are closed with 4401 and
	 * the host is told, also when the relay knew no such device: the host may still know it.
	 */
	revoke(deviceId: string): void {
		const holder =
			this.store.device(deviceId)?.holder ??
			this.store.pairings().find((pairing) => pairing.deviceId === deviceId)?.holder;
		if (holder) this.store.blockHolder(holder);
		const devices = holder ? this.store.devices().filter((device) => device.holder === holder) : [];
		for (const id of new Set([deviceId, ...devices.map((device) => device.deviceId)]))
			this.remove(id);
		for (const pairing of this.store.pairings()) {
			if (pairing.deviceId === deviceId || (holder && pairing.holder === holder))
				this.store.removePairing(pairing.pairingId);
		}
	}

	private remove(deviceId: string): void {
		this.store.removeDevice(deviceId);
		for (const socket of this.sockets.device(deviceId)) {
			this.link.drop(socket, relayCloseCodes.unauthorized);
		}
		this.link.toHost({ type: 'device-revoked', deviceId });
	}
}
