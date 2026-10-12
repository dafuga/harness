import type { SecurePacket } from './RemoteSecure.types';

export const relayCloseCodes = {
	protocol: 4400,
	unauthorized: 4401,
	idle: 4408,
	replaced: 4409,
	tooLarge: 4413,
	rateLimited: 4429
} as const;
/** Request headers of `GET /v1/hosts/{hostId}/connect`, beside `Authorization: Bearer`. */
export const relayHeaders = { role: 'X-Harness-Role', device: 'X-Harness-Device' } as const;
export type RelayErrorCode =
	| 'not-found'
	| 'invalid-input'
	| 'forbidden'
	| 'pairing-unavailable'
	| 'pairing-invalid'
	| 'credential-invalid'
	| 'origin-denied'
	| 'tls-required'
	| 'upgrade-required'
	| 'rate-limited';

export type RelayPairingState = 'open' | 'requested' | 'approved' | 'denied' | 'expired';
export interface RelayPairingInfo {
	hostId: string;
	pairingId: string;
	hostKey: string;
	state: RelayPairingState;
	expiresAt: string;
}
/** `challenge` = base64url(SHA-256(utf8(verifier))). */
export interface RelayPairingRequest {
	ephemeralKey: string;
	sealed: string;
	challenge: string;
}
export interface RelayPairingPoll {
	state: RelayPairingState;
	expiresAt: string;
}
/** Returned exactly once. `credential` goes to the OS key store and nowhere else. */
export interface RelayPairingExchange {
	deviceId: string;
	credential: string;
	sealed: string;
}

/** Relay to device, beside forwarded packets. */
export interface RelayNotice {
	type: 'relay';
	event: 'host-online' | 'host-offline';
}

/** Relay to host. */
export type RelayHostFrame =
	| { type: 'ready'; hostId: string; devices: { deviceId: string; online: boolean }[] }
	| { type: 'device-open'; deviceId: string; connectionId: string }
	| { type: 'device-close'; deviceId: string; connectionId: string }
	| { type: 'packet'; deviceId: string; connectionId: string; packet: SecurePacket }
	| ({ type: 'pairing-request'; pairingId: string } & RelayPairingRequest)
	| { type: 'device-revoked'; deviceId: string }
	| { type: 'ack'; ref: string; ok: boolean; error?: string };

/** Host to relay. Every command with a `ref` is answered by one `ack`. */
export type RelayHostCommand =
	| { type: 'packet'; deviceId: string; connectionId: string; packet: SecurePacket }
	| { type: 'pairing-open'; ref: string; pairingId: string; expiresAt: string }
	/** `challenge` names the one request the host approved; an approval without it is refused. */
	| {
			type: 'pairing-approve';
			ref: string;
			pairingId: string;
			deviceId: string;
			sealed: string;
			challenge: string;
	  }
	| { type: 'pairing-deny'; ref: string; pairingId: string }
	| { type: 'pairing-close'; ref: string; pairingId: string }
	| { type: 'device-revoke'; ref: string; deviceId: string }
	| { type: 'device-drop'; deviceId: string; connectionId: string; code: number };

/** Management reaches a host object through a namespace binding only, never the public Worker. */
export interface RelayManageOwner {
	/** The verified hosted identity of the caller. Never taken from a request body. */
	owner: { id: string };
	hostId: string;
}
export interface RelayManageRegister extends RelayManageOwner {
	hostKey: string;
	credentialHash: string;
	name: string;
}
export interface RelayManageDevice extends RelayManageOwner {
	deviceId: string;
}
export interface RelayRegistered {
	hostId: string;
	generation: number;
	registeredAt: string;
}

/** Hub `POST /api/remote/hosts` response. `origin` is the relay a host and its phones use. */
export interface RemoteHostRegistration extends RelayRegistered {
	origin: string;
}
/** Hub `POST /api/remote/hosts` body. */
export interface RemoteHostRegisterInput {
	hostId: string;
	hostKey: string;
	credentialHash: string;
	name: string;
}
export interface RemoteHostSummary {
	hostId: string;
	name: string;
	online: boolean;
	generation: number;
	registeredAt: string;
	devices: { deviceId: string; online: boolean; createdAt: string; lastSeenAt: string | null }[];
}
