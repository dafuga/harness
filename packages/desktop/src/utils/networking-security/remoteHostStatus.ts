import type { RemoteHostState } from '../../adapters/networking-security/RemoteHostStoreAdapter';
import type { RemoteHostRuntimeService } from '../../services/networking-security/remote-host-service/RemoteHostRuntimeService';

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

export { remoteHostStatus } from '../../services/networking-security/remote-host-service/remoteHostStatus';
