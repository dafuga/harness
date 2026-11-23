// @harness-uid u_6qzr7a2fxr
import type { VaultRunnerPreflight } from '../../validators/accounts-access/VaultWireValidator.types';

export interface VaultExecutorPin {
	host: string;
	publicKey: string;
}

export type VaultRunnerPreflightScope = Omit<VaultRunnerPreflight, 'signature'>;
