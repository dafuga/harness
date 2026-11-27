import type { RelayPairingRequest } from '../../remote/src/index';

/** What a signed-in phone needs to ask one computer of its account: no offer, no code. */
export interface AccountPairingTarget {
	origin: string;
	hostId: string;
	hostKey: string;
	/** Hands the sealed request to the relay as the Hub would, under a verified account. */
	submit: (pairingId: string, body: RelayPairingRequest) => Promise<unknown> | unknown;
	fetch?: typeof fetch;
}
