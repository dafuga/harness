// @harness-uid u_wv57i4bcri
import type { VaultTeardownInput, VaultTeardownStep } from './vaultTeardown.types';

export const vaultTeardownLimits = { completeMs: 120_000, recheckMs: 15 * 60_000 } as const;

/**
 * Orders the end of a lease: stop the gateway, sign out and revoke on the provider, destroy the
 * container, then read the account security log at the end and again 15 minutes later.
 */
export function vaultTeardown(input: VaultTeardownInput): VaultTeardownStep[] {
	const by = input.endedAt + vaultTeardownLimits.completeMs;
	const steps: VaultTeardownStep[] = [{ step: 'close-gateway', by }];
	if (input.browser && input.teardown.logout) {
		steps.push({ step: 'provider-logout', path: input.teardown.logout, by });
	}
	if (input.teardown.revoke)
		steps.push({ step: 'revoke-sessions', via: input.teardown.revoke, by });
	if (input.browser) steps.push({ step: 'remove-container', by }, { step: 'verify-removal', by });
	const source = input.teardown.securityLog;
	if (!source) {
		steps.push({
			step: 'flag-unverifiable',
			reason: 'The recipe has no security log source.',
			at: input.endedAt
		});
		return steps;
	}
	const from = input.leaseStartedAt;
	steps.push(
		{ step: 'security-log', source, at: input.endedAt, from },
		{ step: 'security-log', source, at: input.endedAt + vaultTeardownLimits.recheckMs, from }
	);
	return steps;
}
