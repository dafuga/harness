import type { RemoteKeyPair, SecureRole } from '../models/RemoteSecure.types';

export interface SessionKeyInput {
	role: SecureRole;
	hostId: string;
	deviceId: string;
	generation: number;
	staticKey: RemoteKeyPair;
	ephemeralKey: RemoteKeyPair;
	/** The pinned key of the other side. A peer without its private half derives other keys. */
	peerStatic: Uint8Array;
	peerEphemeral: Uint8Array;
	deviceNonce: Uint8Array;
	hostNonce: Uint8Array;
}

export { sessionKeys } from '../services/secure-channel-service/sessionKeys';
