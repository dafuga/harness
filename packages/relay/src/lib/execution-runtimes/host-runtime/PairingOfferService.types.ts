// @harness-uid u_m6g57qzeqs
export interface Approval {
	pairingId: string;
	deviceId: string;
	sealed: string;
	/** The challenge of the request the host approved. Without it nothing is approved. */
	challenge?: string;
}
