// @harness-uid u_3kkfli5otz
import type { RemotePairInput } from '../../../models/networking-security/RemoteControl.types';
import type { PairingSecret } from '../../../models/networking-security/RemoteSecure.types';
import type { RemoteKeyPair } from '../../../models/networking-security/RemoteSecure.types';
import type { StoredRemoteKeys } from '../../../models/networking-security/RemoteSecure.types';
import type { RemoteGrant } from '../../../models/networking-security/Remote.types';

export class DevicePairingError extends Error {
	override name = 'DevicePairingError';
}

export interface DevicePairingInput extends RemotePairInput {
	platform?: PairingSecret['platform'];
}

/** What a phone holds between its request and the exchange. Nothing here is sent anywhere. */
export interface PendingPairing {
	input: DevicePairingInput;
	origin: string;
	keys: RemoteKeyPair;
	hostKey: string;
	deviceId: string;
	verifier: string;
	approvalKey: CryptoKey;
}

/** What a paired phone keeps in its key store. */
export interface DeviceCredentials {
	origin: string;
	hostId: string;
	hostKey: string;
	hostName: string;
	deviceId: string;
	credential: string;
	keys: StoredRemoteKeys;
	generation: number;
	grant: RemoteGrant;
}
