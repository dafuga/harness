import type { RemoteGrant } from './Remote.types';

/**
 * A one-time offer shown on the computer as a QR code. It lets a phone ask; it is no credential,
 * and asking grants nothing until the person approves the phone that asked.
 */
export interface RemotePairingOffer {
	pairingId: string;
	hostId: string;
	origin: string;
	code: string;
	/** The exact text of the QR code: this offer in the form a phone reads, and nothing else. */
	scan: string;
	expiresAt: string;
}
/** A phone that scanned the offer and waits for the person to approve its exact key. */
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
	/** False grants read-only access; omitted preserves older read-and-comment grants. */
	comments?: boolean;
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
/** `resync` is raised by a client itself after a `gap`; a host never sends it. */
export type RemoteConnectionEvent =
	| { kind: 'grant'; grant: RemoteGrant }
	| { kind: 'revoked' }
	| { kind: 'host'; state: 'suspending' | 'locked' | 'unlocked' }
	| { kind: 'remote-status'; status: RemoteHostStatus }
	| { kind: 'resync' };
/** `deviceId` is the identity of the request the person was shown; another one is refused. */
export interface RemoteApprovalInput {
	pairingId: string;
	deviceId: string;
	projectIds: string[];
	/** False grants read-only access; omitted preserves older read-and-comment grants. */
	comments?: boolean;
	agents: boolean;
}
/** `window.harnessRemote` in Electron. Absent anywhere else. */
export interface RemoteDesktopControl {
	status(): Promise<RemoteHostStatus>;
	enable(): Promise<RemoteHostStatus>;
	disable(): Promise<RemoteHostStatus>;
	/** Opens a new offer. An earlier one stops working. */
	createPairing(): Promise<RemotePairingOffer>;
	/** Withdraws the open offer and whoever asked with it. */
	closePairing(): Promise<RemoteHostStatus>;
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
/** What a device asks with once it read an offer. No page ever holds or sends this. */
export interface RemotePairInput {
	origin: string;
	hostId: string;
	pairingId: string;
	code: string;
	deviceName: string;
}
/** All a page gives the scanner: how this phone is named to the person who approves it. */
export interface RemoteScanInput {
	deviceName: string;
}
/** Every way a scan ends without an offer; the plugin rejects with one of these as its code. */
export const remoteScanFailures = [
	'camera-denied',
	'camera-unavailable',
	'scan-cancelled',
	'offer-invalid',
	'offer-unsupported',
	'offer-environment',
	'offer-expired'
] as const;
export type RemoteScanFailure = (typeof remoteScanFailures)[number];
/** The phone's control port, implemented by the native plugin. */
export interface RemoteMobileControl {
	status(): Promise<RemoteMobileStatus>;
	/**
	 * Opens the camera and asks with the offer it reads. It answers once a request is under way;
	 * the phone is connected only after the person approved it on the computer.
	 */
	scan(input: RemoteScanInput): Promise<RemoteMobileStatus>;
	disconnect(): Promise<RemoteMobileStatus>;
	onStatus(listener: (status: RemoteMobileStatus) => void): () => void;
}
