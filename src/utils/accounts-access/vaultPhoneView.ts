// @harness-uid u_dqmcgtq5ga
import type { VaultPhoneViewInput, VaultPhoneViewPlan } from './vaultPhoneView.types';

export const vaultPhoneViewMs = 10 * 60_000;

/**
 * Chooses how Daniel's phone reaches the guest for private view and control: the paired Harness
 * relay first, then the host's Access-protected tunnel with a one-time token, otherwise no view.
 */
export function vaultPhoneView(input: VaultPhoneViewInput): VaultPhoneViewPlan {
	if (input.phase !== 'pending') {
		return {
			transport: 'none',
			reason: 'Private view is only available while a login is pending.'
		};
	}
	const expiresAt = input.now + vaultPhoneViewMs;
	if (input.relay === 'up') return { transport: 'harness-relay', expiresAt };
	if (input.accessTunnel === 'up')
		return { transport: 'access-tunnel', oneTimeToken: true, expiresAt };
	return {
		transport: 'none',
		reason: 'Neither the Harness relay nor the Access tunnel is reachable.'
	};
}
