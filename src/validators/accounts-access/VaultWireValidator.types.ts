// @harness-uid u_23xwb3xbkg
import type { z } from 'zod';
import type {
	vaultDecision,
	vaultProof,
	vaultRunnerPreflight,
	vaultSealed,
	vaultSessionRequest,
	vaultTicket
} from './VaultWireValidator';

export type VaultSessionRequest = z.output<typeof vaultSessionRequest>;
export type VaultRunnerPreflight = z.output<typeof vaultRunnerPreflight>;
export type VaultTicket = z.output<typeof vaultTicket>;
export type VaultProof = z.output<typeof vaultProof>;
export type VaultSealed = z.output<typeof vaultSealed>;
export type VaultDecision = z.output<typeof vaultDecision>;
export type VaultApproval = Extract<VaultDecision, { decision: 'approve' }>;
