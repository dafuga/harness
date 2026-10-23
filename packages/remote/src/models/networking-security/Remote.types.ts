import type { RemoteGrant } from './RemoteControl.types';
import type {
	remoteLimits,
	remoteMethods,
	remoteErrorMessages,
	REMOTE_PROTOCOL
} from './RemoteValues';

export type RemoteLimits = { readonly [K in keyof typeof remoteLimits]: number };

export type RemoteMethod = (typeof remoteMethods)[number];

export type RemoteErrorCode = keyof typeof remoteErrorMessages;

export interface RemoteError {
	code: RemoteErrorCode;
	message: string;
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
export {
	type RemoteConnectionEvent,
	type RemoteGrant,
	type RemoteRevision,
	REMOTE_PROTOCOL,
	remoteLimits,
	attachMethod,
	readMethods,
	commentMethods,
	agentMethods,
	localMethods,
	controlMethods,
	remoteMethods,
	revisionMethods,
	projectlessMethods,
	mutationMethods,
	remoteErrorMessages,
	RemoteFailure
} from './RemoteValues';
