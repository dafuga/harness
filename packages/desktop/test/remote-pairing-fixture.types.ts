import type { RelayHostCommand } from '../../remote/src/index';
import type { RelayHostFrame } from '../../remote/src/index';

export interface Pairing {
	state: string;
	expiresAt: string;
	challenge?: string;
	approval?: { deviceId: string; sealed: string };
}

export type Fields = Record<string, unknown>;

export type PairingCommand = Exclude<
	Extract<RelayHostCommand, { ref: string }>,
	{ type: 'device-revoke' }
>;

export interface PairingDeskOptions {
	host: () => { hostId: string; hostKey: string };
	toHost: (frame: RelayHostFrame) => void;
	/** A device exchanged its approval: the relay keeps a hash of the credential it was given. */
	issue: (deviceId: string, credential: string) => Promise<void>;
}
