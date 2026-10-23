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
