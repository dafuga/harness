import type { StoredRemoteKeys } from '../../../../remote/src/index';
import type { NativeEncryption } from './NativeSessionAdapter';

/** A phone the person approved, with the exact key and grant of that approval. */
export interface RemoteHostDevice {
	deviceId: string;
	deviceKey: string;
	name: string;
	platform: string;
	projects: { id: string; name: string }[];
	/** False grants read-only access; omitted preserves older read-and-comment grants. */
	comments?: boolean;
	agents: boolean;
	approvedAt: string;
	generation: number;
	lastSeenAt: string | null;
}

/** Everything this computer keeps for remote access. It exists on disk only encrypted. */
export interface RemoteHostState {
	enabled: boolean;
	origin: string | null;
	hostId: string;
	keys: StoredRemoteKeys;
	credential: string;
	generation: number;
	devices: RemoteHostDevice[];
	/** Devices revoked while the relay was unreachable; it is told when it is back. */
	revoked: string[];
}

export interface RemoteHostStoreAdapterConfig {
	file: string;
	/** Electron safeStorage in the app; a deterministic port in tests. */
	encryption: NativeEncryption;
	platform?: NodeJS.Platform;
}
