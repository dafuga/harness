export interface TestHost {
	ownerId: string;
	hostId: string;
	hostKey: string;
	credential: string;
	name: string;
}

export interface TestDevice {
	deviceId: string;
	credential: string;
}

/** A pairing a phone asked for: what it sent, and the verifier only the phone knows. */
export interface TestRequest {
	pairingId: string;
	verifier: string;
	body: { ephemeralKey: string; sealed: string; challenge: string };
}
