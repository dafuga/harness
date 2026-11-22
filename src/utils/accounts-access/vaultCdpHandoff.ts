// @harness-uid u_g7t5qkhn5t
import { createHash, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { VaultCdpConnection, VaultCdpDecision, VaultCdpLease } from './vaultCdpHandoff.types';

const tcpDebugging =
	/^--remote-debugging-(port|address|socket-name)(=|$)|^--remote-allow-origins(=|$)/u;

/**
 * Decides one connection to the session's CDP endpoint. Only the requesting session's OS user,
 * presenting the lease's one-time token, may connect, and only while the lease is attached or
 * waiting for its claim or reconnect.
 */
export function vaultCdpHandoff(
	handoff: VaultCdpLease,
	connection: VaultCdpConnection
): VaultCdpDecision {
	const { lease } = handoff;
	if (lease.phase === 'ended' || connection.at >= lease.expiresAt) {
		return { allowed: false, reason: 'The lease has ended.' };
	}
	if (connection.peerUid === null || connection.peerUid !== handoff.sessionUid) {
		return { allowed: false, reason: 'Only the requesting session user may connect.' };
	}
	if (!tokenMatches(connection.token, handoff.tokenDigest)) {
		return { allowed: false, reason: 'The handoff token is wrong.' };
	}
	return { allowed: true };
}

/** Checks Chromium's launch arguments: CDP over the pipe only, never a TCP debugging port. */
export function vaultChromiumArgs(args: readonly string[]): readonly string[] {
	if (!args.includes('--remote-debugging-pipe')) {
		throw new ExpectedCliError('Chromium must start with --remote-debugging-pipe.');
	}
	const open = args.filter((arg) => tcpDebugging.test(arg));
	if (open.length > 0) {
		throw new ExpectedCliError(
			'Chromium must not open a TCP debugging endpoint: ' + open.join(' ')
		);
	}
	return args;
}

/** The Playwright connectOverCDP address of a lease's Unix socket. */
export function vaultCdpEndpoint(socketPath: string): string {
	if (!isAbsolute(socketPath) || /[:\s]/u.test(socketPath)) {
		throw new ExpectedCliError('The CDP socket path must be absolute, without colons or spaces.');
	}
	return 'ws+unix://' + socketPath + ':/devtools/browser';
}

function tokenMatches(token: string, digest: string): boolean {
	const actual = createHash('sha256').update(token).digest();
	const expected = Buffer.from(digest, 'hex');
	return expected.length === actual.length && timingSafeEqual(actual, expected);
}
