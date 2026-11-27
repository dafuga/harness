// @harness-uid u_ydbpwntlfp
import type { VaultDeviceRepository } from '../../repositories/accounts-access/VaultDeviceRepository';
import type { PrivateBrowserPhoneService } from '../../services/execution-runtimes/PrivateBrowserPhoneService';
import type { VaultLeaseEnded } from '../../services/accounts-access/VaultLeaseKeeperService.types';

export interface CredentialBrokerOptions {
	socket: string;
	state: string;
	/** JSON file `{ "devices": [{ "id", "role", "signingKey" }] }` of enrolled phones. */
	trust: string;
	origin: string;
	/** The protected executor wires its recovered browser gate to these enrolled device pins. */
	privateBrowser?: (devices: VaultDeviceRepository) => PrivateBrowserPhoneService;
	onTeardown?: (plan: VaultLeaseEnded) => void;
}
