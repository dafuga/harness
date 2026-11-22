import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import {
	vaultCdpEndpoint,
	vaultCdpHandoff,
	vaultChromiumArgs
} from '../../../src/utils/accounts-access/vaultCdpHandoff';
import { issueVaultLease, vaultLease } from '../../../src/utils/accounts-access/vaultLease';

const token = 'synthetic-handoff-token';
const t0 = 1_000_000;
const lease = vaultLease(issueVaultLease('lease-1', 'session-a', t0), {
	type: 'claim',
	session: 'session-a',
	at: t0 + 1_000
}).state;
const handoff = {
	lease,
	sessionUid: 501,
	tokenDigest: createHash('sha256').update(token).digest('hex'),
	socketPath: '/run/harness-vault/lease-1/cdp.sock'
};

test('admits only the session user with the one-time token while the lease lasts', () => {
	expect(vaultCdpHandoff(handoff, { peerUid: 501, token, at: t0 + 2_000 })).toEqual({
		allowed: true
	});
	expect(vaultCdpHandoff(handoff, { peerUid: 502, token, at: t0 + 2_000 })).toMatchObject({
		allowed: false
	});
	expect(vaultCdpHandoff(handoff, { peerUid: null, token, at: t0 + 2_000 })).toMatchObject({
		allowed: false
	});
	expect(vaultCdpHandoff(handoff, { peerUid: 501, token: 'guess', at: t0 + 2_000 })).toMatchObject({
		allowed: false,
		reason: 'The handoff token is wrong.'
	});
	expect(vaultCdpHandoff(handoff, { peerUid: 501, token, at: lease.expiresAt })).toMatchObject({
		allowed: false
	});
	const ended = vaultLease(lease, { type: 'finish', at: t0 + 3_000 }).state;
	expect(
		vaultCdpHandoff({ ...handoff, lease: ended }, { peerUid: 501, token, at: t0 + 4_000 })
	).toMatchObject({
		allowed: false
	});
});

test('requires a pipe-only Chromium launch', () => {
	const args = ['--remote-debugging-pipe', '--user-data-dir=/scratch/profile'];
	expect(vaultChromiumArgs(args)).toEqual(args);
	expect(() => vaultChromiumArgs(['--user-data-dir=/scratch/profile'])).toThrow(
		/remote-debugging-pipe/u
	);
	for (const open of [
		'--remote-debugging-port=9222',
		'--remote-debugging-port',
		'--remote-debugging-address=0.0.0.0',
		'--remote-allow-origins=*'
	]) {
		expect(() => vaultChromiumArgs([...args, open])).toThrow(/TCP debugging/u);
	}
});

test('addresses the lease socket the way Playwright connectOverCDP accepts', () => {
	expect(vaultCdpEndpoint(handoff.socketPath)).toBe(
		'ws+unix:///run/harness-vault/lease-1/cdp.sock:/devtools/browser'
	);
	expect(() => vaultCdpEndpoint('relative/cdp.sock')).toThrow(/absolute/u);
	expect(() => vaultCdpEndpoint('/tmp/a:b.sock')).toThrow(/colons/u);
});
