import type { RemoteHostState } from "../adapters/RemoteHostStoreAdapter";
import type { RemoteHostRuntimeService } from "../services/RemoteHostRuntimeService";

export type RemoteHostPhase = 'idle' | 'registering' | 'signed-out';

export interface RemoteHostStatusInput {
	supported: boolean;
	state: RemoteHostState | null;
	runtime: RemoteHostRuntimeService | null;
	phase: RemoteHostPhase;
	reason: string | null;
	name: string;
	projects: { id: string; name: string }[];
}

export { remoteHostStatus } from '../services/remote-host-service/remoteHostStatus';
