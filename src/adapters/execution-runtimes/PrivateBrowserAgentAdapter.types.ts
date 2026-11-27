// @harness-uid u_2gqbg52t3o
import type { Socket } from 'node:net';
import type { PrivateBrowserPhoneService } from '../../services/execution-runtimes/PrivateBrowserPhoneService';
import type { PrivateBrowserFieldScope } from '../../services/execution-runtimes/PrivateBrowserPhoneService.types';
import type { PrivateBrowserGateService } from '../../services/execution-runtimes/PrivateBrowserGateService';

export interface PrivateBrowserAgentAdapterConfig {
	/** Absolute path in a directory the executor can write and the agent can only traverse. */
	socketPath: string;
	agentUid: number;
	/** Wire the kernel lookup from VaultPeerAdapter. Never trust request headers for identity. */
	peerUid(socket: Socket): number | null;
	gate: PrivateBrowserGateService;
	/** Selected by the executor after validating the paired device and reviewed recipe. */
	deviceId: string;
	nativeEntry: {
		delivery: PrivateBrowserPhoneService;
		/** The executor's reviewed scope for the observed tab, evaluated after reads drain. */
		reviewedField(): PrivateBrowserFieldScope | undefined;
	};
	/** One reviewed operation returning only approved output. It must drain its browser work. */
	reviewedRead(signal: AbortSignal): Promise<unknown>;
}
