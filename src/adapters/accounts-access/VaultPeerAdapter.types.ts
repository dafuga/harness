// @harness-uid u_uw3tnnxzru
export interface VaultPeerAdapterConfig {
	binary: string;
}

export interface VaultPeerBinding {
	peerUid(fd: number): number | null;
}
