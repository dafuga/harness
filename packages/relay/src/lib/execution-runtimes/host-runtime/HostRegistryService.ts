// @harness-uid u_3kd7nnqwh4
import { relayCloseCodes } from '../../../../../remote/src/index';
import type {
	RelayManageRegister,
	RelayRegistered,
	RemoteHostSummary
} from '../../../../../remote/src/index';
import type { HostSocketsAdapter } from './HostSocketsAdapter';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostRecord } from '../../../models/networking-security/RelayHost.types';
import type { HostLinkService } from './HostLinkService';

/** The record a registration saves: a new generation that keeps the first date and link. */
function nextRecord(input: RelayManageRegister, current: HostRecord | undefined): HostRecord {
	const { hostId, hostKey, credentialHash, name } = input;
	const generation = (current?.generation ?? 0) + 1;
	const registeredAt = current?.registeredAt ?? new Date().toISOString();
	const ownerId = input.owner.id;
	const accountLinked = current?.accountLinked ?? input.accountLinked;
	return {
		hostId,
		ownerId,
		...(accountLinked && { accountLinked }),
		hostKey,
		credentialHash,
		name,
		generation,
		registeredAt
	};
}

/** The host of an object, as its owner manages it. */
export class HostRegistryService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly sockets: HostSocketsAdapter,
		private readonly link: HostLinkService
	) {}

	/**
	 * The first owner keeps a host. Registering again as that owner rotates the credential: the
	 * old hash is gone, the generation grows and the socket that was opened with it is closed.
	 * Nothing is returned, and nothing changes, for another owner.
	 */
	register(input: RelayManageRegister): RelayRegistered | undefined {
		const current = this.store.host();
		if (current && current.ownerId !== input.owner.id) return undefined;
		const next = nextRecord(input, current);
		if (next.accountLinked && !current?.accountLinked) this.clearLegacy();
		for (const { pairingId } of this.store.pairings()) this.store.removePairing(pairingId);
		this.store.saveHost(next);
		const open = this.sockets.host();
		if (open) this.link.drop(open, relayCloseCodes.unauthorized);
		const { hostId, generation, registeredAt } = next;
		return { hostId, generation, registeredAt };
	}

	private clearLegacy(): void {
		for (const { deviceId } of this.store.devices()) {
			this.store.removeDevice(deviceId);
			for (const socket of this.sockets.device(deviceId))
				this.link.drop(socket, relayCloseCodes.unauthorized);
		}
	}

	summary(host: HostRecord): RemoteHostSummary {
		const { hostId, name, generation, registeredAt, accountLinked } = host;
		const devices = this.store.devices().map(({ deviceId, createdAt, lastSeenAt }) => ({
			deviceId,
			online: this.sockets.device(deviceId).length > 0,
			createdAt,
			lastSeenAt
		}));
		const online = this.sockets.host() !== undefined;
		return {
			hostId,
			name,
			online,
			generation,
			registeredAt,
			devices,
			...(accountLinked && { accountLinked })
		};
	}

	/** Closes every socket with 4401 and deletes everything the object keeps. */
	async unregister(): Promise<void> {
		for (const socket of this.sockets.all()) {
			this.sockets.close(socket, relayCloseCodes.unauthorized);
		}
		await this.store.clear();
	}
}
