import type { RelayPairingState } from '../../src/models/RemoteRelay.types';
import type { HostPairingService } from '../../src/services/host-pairing-service/HostPairingService';
import type { RemotePairingRequest } from '../../src/models/RemoteControl.types';

export interface Entry {
	state: RelayPairingState;
	expiresAt: string;
	challenge?: string;
	approval?: { deviceId: string; sealed: string };
}

export interface RelayInput {
	hostId: string;
	hostKey: string;
	host: HostPairingService;
}

export interface RelayState {
	input: RelayInput;
	relay: { hostKey: string };
	pairings: Map<string, Entry>;
	calls: string[];
	bodies: string[];
	received: (RemotePairingRequest | null)[];
}

export interface Route {
	path: string;
	method: string;
	body: string | null;
	hostId: string;
	pairingId: string;
	operation: string;
}
