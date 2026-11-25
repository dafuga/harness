// @harness-uid u_bvwdaizyn4
/** The checked-out branch and its tip, as the client last saw them. */
export interface RemoteRevision {
	branch: string;
	commit: string;
}

/** The projects and permissions explicitly approved for one phone. */
export interface RemoteGrant {
	projects: { id: string; name: string }[];
	/** False grants read-only access; omitted preserves older read-and-comment grants. */
	comments?: boolean;
	agents: boolean;
}

/** `resync` is raised by a client itself after a `gap`; a host never sends it. */
export type RemoteConnectionEvent =
	| { kind: 'grant'; grant: RemoteGrant }
	| { kind: 'revoked' }
	| { kind: 'host'; state: 'suspending' | 'locked' | 'unlocked' }
	| { kind: 'remote-status'; status: RemoteHostStatus }
	| { kind: 'resync' };

/** A phone that signed in to the account and waits for the person to approve its exact key. */
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
	requests: RemotePairingRequest[];
	devices: RemoteDeviceInfo[];
	projects: { id: string; name: string }[];
}

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

/** What a device asks with for one computer of its account. No page ever holds or sends this. */
export interface RemotePairInput {
	origin: string;
	hostId: string;
	pairingId: string;
	code: string;
	deviceName: string;
}

/** The phone's control port, implemented by the native plugin. */
export interface RemoteAccountComputer {
	hostId: string;
	name: string;
	online: boolean;
}

export interface RemoteAccountComputerInput {
	hostId: string;
	deviceName: string;
}

export interface RemoteMobileControl {
	computers?(): Promise<RemoteAccountComputer[]>;
	connectAccountComputer?(input: RemoteAccountComputerInput): Promise<RemoteMobileStatus>;
	status(): Promise<RemoteMobileStatus>;
	disconnect(): Promise<RemoteMobileStatus>;
	onStatus(listener: (status: RemoteMobileStatus) => void): () => void;
}
