// @harness-uid u_2jn5g5w42t
import type { RemoteNativePlugin } from '../../../../models/development-tooling/Environment.types';
import type { RemoteRevision } from '../../../../models/development-tooling/Environment.types';

export interface CapacitorBridgeAdapterConfig {
	plugin: RemoteNativePlugin;
}

/** What this bridge reads from an input, or adds to it; `sha256` names an artifact asked for. */
export type Input = {
	projectId?: string;
	revision?: RemoteRevision;
	commit?: string | null;
	sha256?: string;
};

export type Operation = (input?: object) => unknown;

/** Refused by the phone before anything is sent: no folder to open, or no branch tip on record. */
export class RequestRefusedError extends Error {
	override name = 'RequestRefusedError';
}
