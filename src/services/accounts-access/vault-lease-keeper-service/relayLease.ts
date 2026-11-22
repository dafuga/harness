// @harness-uid u_crruvpexlz
import { vaultCdpHandoff } from '../../../utils/accounts-access/vaultCdpHandoff';
import type { VaultCdpDecision } from '../../../utils/accounts-access/vaultCdpHandoff.types';
import { vaultLease, vaultLeaseLimits } from '../../../utils/accounts-access/vaultLease';
import type { VaultLeaseEvent } from '../../../utils/accounts-access/vaultLease.types';
import type { VaultHeldLease, VaultRelayEvent } from '../VaultLeaseKeeperService.types';

export function admitVaultRelay(
	held: VaultHeldLease | undefined,
	peerUid: number | null,
	token: string,
	at: number
): VaultCdpDecision {
	if (!held?.tokenDigest) return { allowed: false, reason: 'The lease is not attached.' };
	held.state = vaultLease(held.state, { type: 'tick', at }).state;
	if (held.state.phase === 'active') return { allowed: false, reason: 'CDP is already connected.' };
	if (
		held.state.phase === 'disconnected' &&
		held.state.reconnects >= vaultLeaseLimits.maxReconnects
	) {
		return { allowed: false, reason: 'The reconnect limit was reached.' };
	}
	return vaultCdpHandoff(
		{
			lease: held.state,
			sessionUid: held.sessionUid,
			tokenDigest: held.tokenDigest,
			socketPath: held.socketPath
		},
		{ peerUid, token, at }
	);
}

export function updateVaultRelay(
	held: VaultHeldLease | undefined,
	type: VaultRelayEvent,
	at: number
): boolean {
	if (!held || (type !== 'tick' && !held.tokenDigest)) return false;
	const event: VaultLeaseEvent =
		type === 'connect'
			? {
					type: held.state.phase === 'issued' ? 'claim' : 'reconnect',
					session: held.state.session,
					at
				}
			: { type, at };
	const result = vaultLease(held.state, event);
	held.state = result.state;
	return result.accepted;
}
