import { expect, test } from 'vitest';
import {
	issueVaultLease,
	vaultLease,
	vaultLeaseLimits
} from '../../../src/utils/accounts-access/vaultLease';

const t0 = 1_000_000;
const issued = () => issueVaultLease('lease-1', 'session-a', t0);
const active = () =>
	vaultLease(issued(), { type: 'claim', session: 'session-a', at: t0 + 1_000 }).state;

test('is claimed once, by the requesting session only, within 60 s', () => {
	expect(vaultLease(issued(), { type: 'claim', session: 'session-b', at: t0 + 1 })).toMatchObject({
		accepted: false,
		reason: 'The lease belongs to another session.'
	});
	const state = active();
	expect(state.phase).toBe('active');
	expect(vaultLease(state, { type: 'claim', session: 'session-a', at: t0 + 2_000 }).accepted).toBe(
		false
	);
	const late = vaultLease(issued(), {
		type: 'claim',
		session: 'session-a',
		at: t0 + vaultLeaseLimits.claimMs
	});
	expect(late).toMatchObject({ accepted: false, state: { ended: 'unclaimed' } });
});

test('ends on idle, hard expiry and finish', () => {
	const idle = vaultLease(active(), {
		type: 'activity',
		at: t0 + 1_000 + vaultLeaseLimits.idleMs
	});
	expect(idle.state.ended).toBe('idle');
	const busy = [1, 2, 3, 4].reduce(
		(state, minute) => vaultLease(state, { type: 'activity', at: t0 + minute * 4 * 60_000 }).state,
		active()
	);
	expect(vaultLease(busy, { type: 'tick', at: t0 + vaultLeaseLimits.defaultMs }).state.ended).toBe(
		'expired'
	);
	expect(vaultLease(active(), { type: 'finish', at: t0 + 5_000 }).state.ended).toBe('finished');
});

test('allows a bounded same-session reconnect', () => {
	let state = active();
	for (let attempt = 1; attempt <= vaultLeaseLimits.maxReconnects; attempt += 1) {
		state = vaultLease(state, { type: 'disconnect', at: t0 + attempt * 10_000 }).state;
		state = vaultLease(state, {
			type: 'reconnect',
			session: 'session-a',
			at: t0 + attempt * 10_000 + 5_000
		}).state;
		expect(state).toMatchObject({ phase: 'active', reconnects: attempt });
	}
	state = vaultLease(state, { type: 'disconnect', at: t0 + 50_000 }).state;
	expect(
		vaultLease(state, { type: 'reconnect', session: 'session-a', at: t0 + 51_000 }).state.ended
	).toBe('reconnect-window');
	const gone = vaultLease(active(), { type: 'disconnect', at: t0 + 2_000 }).state;
	const late = vaultLease(gone, {
		type: 'reconnect',
		session: 'session-a',
		at: t0 + 2_000 + vaultLeaseLimits.reconnectMs
	});
	expect(late).toMatchObject({ accepted: false, state: { ended: 'reconnect-window' } });
});

test('clamps the recipe lease length to the 60 minute maximum', () => {
	const lease = issueVaultLease('lease-2', 'session-a', t0, 5 * 3_600_000);
	expect(lease.expiresAt - t0).toBe(vaultLeaseLimits.maxMs);
});
