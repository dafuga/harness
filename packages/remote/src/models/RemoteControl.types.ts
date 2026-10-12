import type { RemoteGrant } from './Remote.types';

/** A one-time offer shown on the computer. `code` is typed on the phone; it is no credential. */
export interface RemotePairingOffer {
	pairingId: string;
	hostId: string;
	origin: string;
	code: string;
	/** Public identifiers only: no code, no credential. */
	link: string;
	expiresAt: string;
}
/** A phone that proved the code and waits for the person to approve its exact key. */
export interface RemotePairingRequest {
	pairingId: string;
	deviceId: string;
	deviceName: string;
	platform: string;
	requestedAt: string;
	expiresAt: string;
}
export interface RemoteDeviceInfo {
	deviceId: string;
	name: string;
	platform: string;
	projectIds: string[];
	agents: boolean;
	approvedAt: string;
	lastSeenAt: string | null;
	online: boolean;
}
export type RemoteHostState =
	| 'disabled'
	| 'unavailable'
	| 'signed-out'
	| 'registering'
	| 'connecting'
	| 'online'
	| 'offline';
/** Public metadata only: nothing here is a key or a credential. */
export interface RemoteHostStatus {
	supported: boolean;
	enabled: boolean;
	state: RemoteHostState;
	reason: string | null;
	host: { id: string; name: string } | null;
	origin: string | null;
	pairing: RemotePairingOffer | null;
	requests: RemotePairingRequest[];
	devices: RemoteDeviceInfo[];
	projects: { id: string; name: string }[];
}
/** `deviceId` is the identity of the request the person was shown; another one is refused. */
export interface RemoteApprovalInput {
	pairingId: string;
	deviceId: string;
	projectIds: string[];
	agents: boolean;
}
/** `window.harnessRemote` in Electron. Absent anywhere else. */
export interface RemoteDesktopControl {
	status(): Promise<RemoteHostStatus>;
	enable(): Promise<RemoteHostStatus>;
	disable(): Promise<RemoteHostStatus>;
	createPairing(): Promise<RemotePairingOffer>;
	approvePairing(input: RemoteApprovalInput): Promise<RemoteHostStatus>;
	denyPairing(input: { pairingId: string }): Promise<RemoteHostStatus>;
	revokeDevice(input: { deviceId: string }): Promise<RemoteHostStatus>;
	onStatus(listener: (status: RemoteHostStatus) => void): () => void;
}

export type RemoteMobileState =
	| 'unpaired'
	| 'pairing'
	| 'pending-approval'
	| 'connecting'
	| 'online'
	| 'offline'
	| 'revoked';
export interface RemoteMobileStatus {
	state: RemoteMobileState;
	origin: string | null;
	host: { id: string; name: string } | null;
	device: { id: string; name: string } | null;
	grant: RemoteGrant | null;
	reason: string | null;
	lastOnlineAt: string | null;
}
export interface RemotePairInput {
	origin: string;
	hostId: string;
	pairingId: string;
	code: string;
	deviceName: string;
}
/** The phone's control port, implemented by the native plugin. */
export interface RemoteMobileControl {
	status(): Promise<RemoteMobileStatus>;
	pair(input: RemotePairInput): Promise<RemoteMobileStatus>;
	disconnect(): Promise<RemoteMobileStatus>;
	onStatus(listener: (status: RemoteMobileStatus) => void): () => void;
}
