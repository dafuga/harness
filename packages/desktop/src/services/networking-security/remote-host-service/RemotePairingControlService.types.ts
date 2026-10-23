import type { RemoteHostState } from '../../../adapters/networking-security/RemoteHostStoreAdapter';
import type { RemoteHostRuntimeService } from './RemoteHostRuntimeService';
import type { RemoteHostStatus } from '../../../../../remote/src/index';

/** What the pairing control needs of the host: the running host, and a way to keep changes. */
export interface RemoteHostAccess {
	/** Throws when remote access is off. */
	current(): { state: RemoteHostState; runtime: RemoteHostRuntimeService };
	saved(): Promise<RemoteHostStatus>;
	published(): Promise<RemoteHostStatus>;
	name(): string;
}
