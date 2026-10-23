import type { SecureDirection } from '../../src/models/RemoteSecure.types';
import type { StoredRemoteKeys } from '../../src/models/RemoteSecure.types';

export interface VectorPacket {
	direction: SecureDirection;
	counter: number;
	more: boolean;
	plaintext: string;
	data: string;
}

export interface SecureVectors {
	hostStatic: StoredRemoteKeys;
	deviceStatic: StoredRemoteKeys;
	hostEphemeral: StoredRemoteKeys;
	deviceEphemeral: StoredRemoteKeys;
	hostId: string;
	deviceId: string;
	generation: number;
	deviceNonce: string;
	hostNonce: string;
	session: { d2h: string; h2d: string; packets: VectorPacket[] };
	pairing: {
		pairingId: string;
		ephemeral: StoredRemoteKeys;
		requestPlain: string;
		requestSealed: string;
		approvalPlain: string;
		approvalSealed: string;
	};
	credential: { credential: string; hostHash: string; deviceHash: string };
}
