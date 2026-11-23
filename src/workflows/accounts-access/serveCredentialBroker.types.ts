// @harness-uid u_ydbpwntlfp
import type { VaultLeaseEnded } from '../../services/accounts-access/VaultLeaseKeeperService.types';

export interface CredentialBrokerOptions {
	socket: string;
	state: string;
	/** JSON with enrolled `devices` and executor `executors` public-key pins. */
	trust: string;
	origin: string;
	/** Node-API module used to check the connecting Unix user. */
	peerAddon?: string;
	onTeardown?: (plan: VaultLeaseEnded) => void;
}
