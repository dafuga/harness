import type { RemoteHostRecordService } from '../RemoteHostRecordService';
import type { RegisterRemoteHost } from '../../../../utils/networking-security/remoteHostIdentity';
import type { RemoteHostState } from '../../../../adapters/networking-security/RemoteHostStoreAdapter';
import type { RemoteKeyPair } from '../../../../../../remote/src/index';
import type { RemoteHostPhase } from '../../../../utils/networking-security/remoteHostStatus';

export interface RemoteHostSwitchOptions {
	record: RemoteHostRecordService;
	/** Registers this computer under the signed-in hosted identity; rejects when there is none. */
	register: RegisterRemoteHost;
	name: () => string;
	/** The host goes online with this registration, in place of one that runs. */
	run: (state: RemoteHostState, keys: RemoteKeyPair) => void;
	/** The running host ends. */
	close: () => void;
	/** Told when what the status shows changes while a request is still under way. */
	changed: () => void;
}

export type Shown = [RemoteHostPhase, string | null];
