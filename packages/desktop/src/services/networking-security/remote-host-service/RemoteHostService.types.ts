import type { RemoteHostStoreAdapter } from '../../../adapters/networking-security/RemoteHostStoreAdapter';
import type { RegisterRemoteHost } from '../../../utils/networking-security/remoteHostIdentity';
import type { RemoteSocket } from '../../../../../remote/src/index';
import type { RemoteDeviceSessionsOptions } from './RemoteDeviceSessionsService';
import type { RelayLinkTuning } from './RemoteHostRuntimeService';

export interface RemoteHostOptions {
	store: RemoteHostStoreAdapter;
	/** Registers this computer under the signed-in hosted identity; rejects when there is none. */
	register: RegisterRemoteHost;
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	shared: RemoteDeviceSessionsOptions['shared'];
	name?: () => string;
	link?: RelayLinkTuning;
	/** Whether the screen is locked, once that is known. */
	locked?: () => boolean | undefined;
}
