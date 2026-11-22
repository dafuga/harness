// @harness-uid u_ydbpwntlfp
import type { VaultLeaseEnded } from '../../services/accounts-access/VaultLeaseKeeperService.types';

export interface CredentialBrokerOptions {
	socket: string;
	state: string;
	/** JSON file `{ "devices": [{ "id", "role", "signingKey" }] }` of enrolled phones. */
	trust: string;
	origin: string;
	onTeardown?: (plan: VaultLeaseEnded) => void;
}
