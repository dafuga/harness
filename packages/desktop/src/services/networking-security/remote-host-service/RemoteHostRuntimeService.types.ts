// @harness-uid u_22fuh23n54
import type { RemoteHostRuntimeService } from './RemoteHostRuntimeService';
import type { RelayLinkOptions } from './relay-link-service/RelayLinkService';
import type { RemoteHostState } from '../../../adapters/networking-security/RemoteHostStoreAdapter';
import type { RemoteKeyPair, RemotePairingRequest } from '../../../../../remote/src/index';
import type { RemoteSocket } from '../../../../../remote/src/index';
import type { RemoteDeviceSessionsOptions } from './RemoteDeviceSessionsService';

export type RelayLinkTuning = Pick<RelayLinkOptions, 'retryMs' | 'pingMs' | 'idleMs' | 'ackMs'>;

export interface RemoteHostRuntimeOptions {
	/** The live state: an approval or a revocation made later is seen here at once. */
	state: RemoteHostState;
	keys: RemoteKeyPair;
	name: string;
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	shared: RemoteDeviceSessionsOptions['shared'];
	link?: RelayLinkTuning;
	locked?: () => boolean | undefined;
	changed: () => void;
	unlinked?: () => void;
	accountRequest: (runtime: RemoteHostRuntimeService, request: RemotePairingRequest) => void;
	/** The relay is reachable again. */
	ready: () => void;
	/** The owner revoked a device through the hub. */
	revoked: (deviceId: string) => void;
	seen: (deviceId: string) => void;
}
