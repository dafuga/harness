import type { RemoteHostStatus } from './RemoteControl.types';

/** Wire v1. A host answers no other protocol number. */
export const REMOTE_PROTOCOL = 1;

/** Every bound of the protocol. A host also returns them from `session.attach`. */
export const remoteLimits = {
	frameBytes: 262144,
	chunkBytes: 131072,
	requestBytes: 65536,
	messageBytes: 16777216,
	pendingRequests: 32,
	ledgerEntries: 256,
	ledgerTtlMs: 900000,
	eventLog: 512,
	requestDeadlineMs: 30000,
	mutationDeadlineMs: 120000,
	handshakeDeadlineMs: 10000,
	pingMs: 25000,
	idleMs: 90000,
	pairingTtlMs: 300000,
	pairingAttempts: 5
} as const;
export type RemoteLimits = { readonly [K in keyof typeof remoteLimits]: number };

export const attachMethod = 'session.attach';
/** Reads of a granted project. */
export const readMethods = [
	'listProjects',
	'capabilities',
	'snapshot',
	'entity',
	'history',
	'source',
	'image',
	'evidence',
	'artifact',
	'messages',
	'pendingComments',
	'providers'
] as const;
/** A person's own comment, and the thread it needs. No planning, approval or run comes with it. */
export const commentMethods = ['addComment', 'openThread'] as const;
/** Planning writes and agent runs: only with the `agents` permission of a grant. */
export const agentMethods = ['createPlan', 'approve', 'startRun', 'cancelRun'] as const;
/** Never available to a remote device: folders and hosted credentials stay on the computer. */
export const localMethods = [
	'deploymentStatus',
	'deploymentActivities',
	'startDeployment',
	'deploymentProgress',
	'planDeployment',
	'deploy',
	'openProject',
	'selectProject',
	'hostedStatus',
	'connectHosted',
	'disconnectHosted'
] as const;
/** The desktop control port. Local connection only. */
export const controlMethods = [
	'remote.status',
	'remote.enable',
	'remote.disable',
	'remote.createPairing',
	'remote.closePairing',
	'remote.approvePairing',
	'remote.denyPairing',
	'remote.revokeDevice'
] as const;
export const remoteMethods = [
	attachMethod,
	...readMethods,
	...commentMethods,
	...agentMethods,
	...localMethods,
	...controlMethods
] as const;
export type RemoteMethod = (typeof remoteMethods)[number];

/** A device needs an explicit, checked-out revision for each of these. */
export const revisionMethods: readonly RemoteMethod[] = [
	'createPlan',
	'openThread',
	'approve',
	'startRun'
];
export const projectlessMethods: readonly RemoteMethod[] = [
	attachMethod,
	'listProjects',
	'deploymentActivities',
	'providers'
];
/** Answers remembered by request id: re-sending one of these never runs it twice. */
export const mutationMethods: readonly RemoteMethod[] = [
	...commentMethods,
	...agentMethods,
	'deploy',
	'planDeployment',
	'startDeployment',
	'openProject',
	'selectProject',
	'connectHosted',
	'disconnectHosted',
	'remote.enable',
	'remote.disable',
	'remote.createPairing',
	'remote.closePairing',
	'remote.approvePairing',
	'remote.denyPairing',
	'remote.revokeDevice'
];

export const remoteErrorMessages = {
	'invalid-message': 'The request was not understood.',
	'unknown-method': 'This operation does not exist.',
	'method-denied': 'This operation is not available on this connection.',
	'not-attached': 'The connection has not been attached.',
	'protocol-unsupported': 'This app and the computer use different protocol versions.',
	'project-required': 'Name the project for this request.',
	'project-denied': 'This device has no access to that project.',
	'revision-required': 'Name the branch and commit this change applies to.',
	'revision-mismatch': 'The branch moved. Reload it and try again.',
	'read-only':
		'Historical views and other branches are read-only. View the checked-out branch tip to make changes.',
	'agents-denied': 'This device may read and comment, but not plan or change.',
	busy: 'Another run or change is active in this project.',
	'request-conflict': 'This request id was already used for something else.',
	'request-expired': 'This change may already have been made. Reload before trying again.',
	'too-large': 'The message is too large.',
	'too-many-requests': 'Too many requests are waiting.',
	deadline: 'The computer did not answer in time.',
	revoked: 'This device is no longer approved.',
	offline: 'The computer is not connected.',
	failed: 'The computer could not complete this request.'
} as const;
export type RemoteErrorCode = keyof typeof remoteErrorMessages;
export interface RemoteError {
	code: RemoteErrorCode;
	message: string;
}

/** The only failure a wire peer reports. `message` is display text without paths or secrets. */
export class RemoteFailure extends Error {
	/** Set when the failing request could still be identified, so it can be answered. */
	requestId?: string;
	constructor(
		readonly code: RemoteErrorCode,
		message?: string
	) {
		super(message ?? remoteErrorMessages[code]);
		this.name = 'RemoteFailure';
	}
}

export type WireChannel = 'run' | 'cache' | 'connection';
export interface WireRequest {
	type: 'request';
	id: string;
	method: RemoteMethod;
	input: Record<string, unknown>;
}
export type WireResponse =
	| { type: 'response'; id: string; ok: true; value: unknown }
	| { type: 'response'; id: string; ok: false; error: RemoteError };
export interface WireEvent {
	type: 'event';
	channel: WireChannel;
	sequence: number;
	value: unknown;
}
export type WireMessage = WireRequest | WireResponse | WireEvent;

/** The checked-out branch and its tip, as the client last saw them. */
export interface RemoteRevision {
	branch: string;
	commit: string;
}
export interface RemoteGrant {
	projects: { id: string; name: string }[];
	agents: boolean;
}
export interface RemoteResume {
	epoch: string;
	sequence: number;
}
export interface AttachInput {
	protocol: typeof REMOTE_PROTOCOL;
	client: { kind: 'electron' | 'ios' | 'test'; name: string };
	resume: RemoteResume | null;
}
export interface RemoteAttachment {
	protocol: typeof REMOTE_PROTOCOL;
	role: 'local' | 'device';
	epoch: string;
	sequence: number;
	replay: 'none' | 'resumed' | 'gap';
	/** `locked` is present only when the computer knows it; absent means unknown. */
	host: { id: string | null; name: string; platform: string; locked?: boolean };
	device: { id: string; name: string } | null;
	grant: RemoteGrant | null;
	methods: RemoteMethod[];
	limits: RemoteLimits;
}
export interface RemoteBinary {
	encoding: 'base64';
	/** `image/png` for a design image; a recorded artifact carries its own. */
	mediaType: string;
	byteLength: number;
	sha256: string;
	data: string;
}
/** `resync` is raised by a client itself after a `gap`; a host never sends it. */
export type RemoteConnectionEvent =
	| { kind: 'grant'; grant: RemoteGrant }
	| { kind: 'revoked' }
	| { kind: 'host'; state: 'suspending' | 'locked' | 'unlocked' }
	| { kind: 'remote-status'; status: RemoteHostStatus }
	| { kind: 'resync' };
