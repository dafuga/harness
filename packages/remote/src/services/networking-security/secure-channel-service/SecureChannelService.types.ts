import type { SecureRole } from '../../../models/networking-security/RemoteSecure.types';
import type { RemoteKeyPair } from '../../../models/networking-security/RemoteSecure.types';

export interface SecureChannelOptions {
	role: SecureRole;
	hostId: string;
	deviceId: string;
	staticKey: RemoteKeyPair;
	/** The pinned static key of the other side. */
	peerKey: Uint8Array;
	/** Host only: the approval generation of the device, bound into the keys. */
	generation?: number;
	limits?: { chunkBytes?: number; messageBytes?: number };
	/** Fixed values, for the frozen vectors only. */
	ephemeral?: RemoteKeyPair;
	nonce?: Uint8Array;
}
