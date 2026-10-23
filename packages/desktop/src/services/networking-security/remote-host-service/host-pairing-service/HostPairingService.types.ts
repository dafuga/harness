import type { RemoteKeyPair } from '../../../../../../remote/src/models/RemoteSecure.types';
import type { RelayPairingRequest } from '../../../../../../remote/src/models/RemoteRelay.types';
import type { RemotePairingRequest } from '../../../../../../remote/src/models/RemoteControl.types';

export interface HostPairingOptions {
	hostId: string;
	keys: RemoteKeyPair;
	now?: () => number;
	ttlMs?: number;
	attempts?: number;
}

export interface HostPairingOffer {
	pairingId: string;
	code: string;
	expiresAt: string;
}

export interface HostPairingFrame extends RelayPairingRequest {
	pairingId: string;
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

export interface Offer extends HostPairingOffer {
	misses: number;
	request: Requested | null;
}
