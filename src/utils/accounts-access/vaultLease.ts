// @harness-uid u_gs3dblm5pw
import type {
	VaultLeaseEnd,
	VaultLeaseEvent,
	VaultLeaseResult,
	VaultLeaseState
} from './vaultLease.types';

export const vaultLeaseLimits = {
	claimMs: 60_000,
	defaultMs: 15 * 60_000,
	maxMs: 60 * 60_000,
	idleMs: 5 * 60_000,
	reconnectMs: 30_000,
	maxReconnects: 3
} as const;

const endings: Record<string, VaultLeaseEnd> = {
	finish: 'finished',
	revoke: 'revoked',
	shutdown: 'shutdown'
};

/** Issues a lease to one session; the recipe may shorten or lengthen it up to the hard maximum. */
export function issueVaultLease(
	id: string,
	session: string,
	issuedAt: number,
	leaseMs: number = vaultLeaseLimits.defaultMs
): VaultLeaseState {
	const length = Math.min(Math.max(leaseMs, 60_000), vaultLeaseLimits.maxMs);
	return {
		id,
		session,
		phase: 'issued',
		issuedAt,
		claimBy: issuedAt + vaultLeaseLimits.claimMs,
		expiresAt: issuedAt + length,
		lastActivity: issuedAt,
		disconnectedAt: null,
		reconnects: 0,
		ended: null
	};
}

/** Applies one event after settling the time limits that passed before it. */
export function vaultLease(current: VaultLeaseState, event: VaultLeaseEvent): VaultLeaseResult {
	const state = settle(current, event.at);
	if (state.phase === 'ended') return refuse(state, 'The lease has ended (' + state.ended + ').');
	if (event.type in endings) return accept(end(state, endings[event.type]));
	if (event.type === 'tick') return accept(state);
	if (event.type === 'claim' || event.type === 'reconnect') return attach(state, event);
	if (state.phase !== 'active') return refuse(state, 'The lease is not attached.');
	if (event.type === 'disconnect') {
		return accept({ ...state, phase: 'disconnected', disconnectedAt: event.at });
	}
	return accept({ ...state, lastActivity: event.at });
}

function attach(
	state: VaultLeaseState,
	event: { type: 'claim' | 'reconnect'; session: string; at: number }
): VaultLeaseResult {
	if (event.session !== state.session)
		return refuse(state, 'The lease belongs to another session.');
	const expected = event.type === 'claim' ? 'issued' : 'disconnected';
	if (state.phase !== expected)
		return refuse(state, 'The lease cannot be ' + event.type + 'ed now.');
	if (event.type === 'reconnect' && state.reconnects >= vaultLeaseLimits.maxReconnects) {
		return accept(end(state, 'reconnect-window'), false, 'The reconnect limit was reached.');
	}
	const reconnects = state.reconnects + (event.type === 'reconnect' ? 1 : 0);
	return accept({
		...state,
		phase: 'active',
		lastActivity: event.at,
		disconnectedAt: null,
		reconnects
	});
}

function settle(state: VaultLeaseState, at: number): VaultLeaseState {
	if (state.phase === 'ended') return state;
	if (at >= state.expiresAt) return end(state, 'expired');
	if (state.phase === 'issued' && at >= state.claimBy) return end(state, 'unclaimed');
	if (state.phase === 'active' && at - state.lastActivity >= vaultLeaseLimits.idleMs) {
		return end(state, 'idle');
	}
	const gone = state.disconnectedAt;
	if (
		state.phase === 'disconnected' &&
		gone !== null &&
		at - gone >= vaultLeaseLimits.reconnectMs
	) {
		return end(state, 'reconnect-window');
	}
	return state;
}

function end(state: VaultLeaseState, ended: VaultLeaseEnd): VaultLeaseState {
	return { ...state, phase: 'ended', ended };
}

function accept(state: VaultLeaseState, accepted = true, reason?: string): VaultLeaseResult {
	return reason === undefined ? { state, accepted } : { state, accepted, reason };
}

function refuse(state: VaultLeaseState, reason: string): VaultLeaseResult {
	return { state, accepted: false, reason };
}
