// @harness-uid u_ydbpwntlfp
import type { PrivateBrowserAgentAdapter } from '../../adapters/execution-runtimes/PrivateBrowserAgentAdapter';
import type { PrivateBrowserGateService } from '../../services/execution-runtimes/PrivateBrowserGateService';
import type { PrivateBrowserPhoneService } from '../../services/execution-runtimes/PrivateBrowserPhoneService';
import type { PrivateBrowserAgentAdapterConfig } from '../../adapters/execution-runtimes/PrivateBrowserAgentAdapter.types';
import type { PrivateBrowserCleanup } from '../../services/execution-runtimes/PrivateBrowserGateService.types';
import type {
	PrivateBrowserFieldScope,
	PrivateBrowserPhoneConfig
} from '../../services/execution-runtimes/PrivateBrowserPhoneService.types';
import type { VaultLeaseEnded } from '../../services/accounts-access/VaultLeaseKeeperService.types';

export interface CredentialBrokerOptions {
	socket: string;
	state: string;
	/** JSON file `{ "devices": [{ "id", "role", "signingKey" }] }` of enrolled phones. */
	trust: string;
	origin: string;
	/** Executor-owned agent socket, reviewed browser callbacks and one enrolled approver on a protected host. */
	privateBrowserExecutor?: PrivateBrowserExecutorOptions;
	onTeardown?: (plan: VaultLeaseEnded) => void;
}

export interface PrivateBrowserExecutorOptions {
	agent: Omit<PrivateBrowserAgentAdapterConfig, 'gate' | 'nativeEntry'>;
	cleanup: PrivateBrowserCleanup;
	reviewedField(): PrivateBrowserFieldScope | undefined;
	submitField: PrivateBrowserPhoneConfig['submitField'];
}

export interface PrivateBrowserRuntime {
	gate: PrivateBrowserGateService;
	delivery: PrivateBrowserPhoneService;
	agent: PrivateBrowserAgentAdapter;
}
