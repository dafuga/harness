// @harness-uid u_at4omr5js3
import type { RemoteKeyPair } from '../../../../../../remote/src/models/networking-security/RemoteSecure.types';
import type { RelayPairingRequest } from '../../../../../../remote/src/models/networking-security/RemoteRelay.types';
import type { RemotePairingRequest } from '../../../../../../remote/src/models/networking-security/RemoteControl.types';

export interface HostPairingOptions {
	hostId: string;
	keys: RemoteKeyPair;
	now?: () => number;
}

export interface HostPairingFrame extends RelayPairingRequest {
	pairingId: string;
	account?: true;
	expiresAt?: string;
}

export interface HostPairingApproved {
	deviceId: string;
	deviceKey: string;
	deviceName: string;
	platform: string;
	sealed: string;
	/** The challenge of the request that was approved: the relay binds the approval to it. */
	challenge: string;
}

export interface Requested extends RemotePairingRequest {
	challenge: string;
	deviceKey: string;
	approvalKey: CryptoKey;
}

export interface Offer {
	pairingId: string;
	expiresAt: string;
	request: Requested | null;
}
