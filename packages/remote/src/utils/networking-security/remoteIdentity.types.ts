export interface CredentialBinding {
	role: 'host' | 'device';
	hostId: string;
	deviceId?: string;
	credential: string;
}
