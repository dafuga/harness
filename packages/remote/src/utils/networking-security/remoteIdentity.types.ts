// @harness-uid u_sl6jhpdbx4
export interface CredentialBinding {
	role: 'host' | 'device';
	hostId: string;
	deviceId?: string;
	credential: string;
}
