// @harness-uid u_ipjjmhcibp
import type {
	VaultSecurityEvent,
	VaultSecurityVerdict
} from '../../utils/accounts-access/vaultSecurityAudit.types';
import type { VaultTeardownStep } from '../../utils/accounts-access/vaultTeardown.types';

export type VaultSecurityCheck = Extract<VaultTeardownStep, { step: 'security-log' }>;
export type VaultCleanupStep = Exclude<
	VaultTeardownStep,
	{ step: 'security-log' | 'flag-unverifiable' }
>;

export interface VaultTeardownConfig {
	cleanup(step: VaultCleanupStep): Promise<void>;
	readSecurityLog(step: VaultSecurityCheck): Promise<VaultSecurityEvent[] | null>;
	now?: () => number;
}

export interface VaultTeardownOutcome {
	failed: VaultCleanupStep['step'][];
	audit: VaultSecurityVerdict[];
	followUps: VaultSecurityCheck[];
}
