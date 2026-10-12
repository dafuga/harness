import { relayCloseCodes } from '../../../remote/src/index';
import type {
	RelayManageRegister,
	RelayRegistered,
	RemoteHostSummary
} from '../../../remote/src/index';
import type { HostSocketsAdapter } from '../adapters/HostSocketsAdapter';
import type { HostStorageAdapter } from '../adapters/HostStorageAdapter';
import type { HostRecord } from '../models/RelayHost.types';
import type { HostLinkService } from './HostLinkService';

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
		const { hostId, hostKey, credentialHash, name } = input;
		const generation = (current?.generation ?? 0) + 1;
		const registeredAt = current?.registeredAt ?? new Date().toISOString();
		const ownerId = input.owner.id;
		this.store.saveHost({
			hostId,
			ownerId,
			hostKey,
			credentialHash,
			name,
			generation,
			registeredAt
		});
		const open = this.sockets.host();
		if (open) this.link.drop(open, relayCloseCodes.unauthorized);
		return { hostId, generation, registeredAt };
	}

	summary(host: HostRecord): RemoteHostSummary {
		const { hostId, name, generation, registeredAt } = host;
		const devices = this.store.devices().map(({ deviceId, createdAt, lastSeenAt }) => ({
			deviceId,
			online: this.sockets.device(deviceId).length > 0,
			createdAt,
			lastSeenAt
		}));
		const online = this.sockets.host() !== undefined;
		return { hostId, name, online, generation, registeredAt, devices };
	}

	/** Closes every socket with 4401 and deletes everything the object keeps. */
	async unregister(): Promise<void> {
		for (const socket of this.sockets.all()) {
			this.sockets.close(socket, relayCloseCodes.unauthorized);
		}
		await this.store.clear();
	}
}
