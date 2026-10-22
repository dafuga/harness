import type { RelayPairingState } from '../../../../remote/src/index';

/** Bindings and variables of the relay Worker (`wrangler.jsonc`). */
export interface RelayEnv {
	REMOTE_HOSTS: DurableObjectNamespace;
	HARNESS_ENVIRONMENT?: string;
	/** Exact origins, separated by commas or spaces, that may open a socket from a browser. */
	HARNESS_RELAY_ALLOWED_ORIGINS?: string;
}

/** What a host object knows about itself without reading anything. */
export interface HostScope {
	/** Whether this object is the one a host id names (`idFromName(hostId)`). */
	owns(hostId: string): boolean;
}

/** Everything a host object keeps. Credentials are kept as hashes only. */
export interface HostRecord {
	hostId: string;
	ownerId: string;
	hostKey: string;
	credentialHash: string;
	name: string;
	generation: number;
	registeredAt: string;
}
export interface DeviceRecord {
	deviceId: string;
	credentialHash: string;
	generation: number;
	createdAt: string;
	lastSeenAt: string | null;
}
export interface PairingRecord {
	pairingId: string;
	state: Exclude<RelayPairingState, 'expired'>;
	/** Milliseconds since the epoch. */
	expiresAt: number;
	attempts: number;
	request?: { ephemeralKey: string; sealed: string };
	challenge?: string;
	deviceId?: string;
	approval?: string;
}
/** One fixed window of a rate limit. */
export interface RateRecord {
	startedAt: number;
	count: number;
}
export type RateBucket = 'connect' | 'pairing';

export type SocketRole = 'host' | 'device';
/** What the headers of a connect request claim. `deviceId` is empty for a host. */
export interface ConnectClaims {
	role: SocketRole;
	credential: string;
	deviceId: string;
}
/** Kept on the socket itself, so that it survives hibernation. */
export type SocketAttachment =
	| { role: 'host'; closed: boolean }
	| { role: 'device'; deviceId: string; connectionId: string; closed: boolean };
export type DeviceAttachment = Extract<SocketAttachment, { role: 'device' }>;

export type PairingAction = 'info' | 'request' | 'poll' | 'exchange';
/** The whole public surface. `path` is rebuilt from validated parts, never copied from a request. */
export type PublicRoute =
	| { kind: 'health'; path: string }
	| { kind: 'connect'; path: string; hostId: string }
	| { kind: 'pairing'; path: string; hostId: string; pairingId: string; action: PairingAction };
export type PairingRoute = Extract<PublicRoute, { kind: 'pairing' }>;
