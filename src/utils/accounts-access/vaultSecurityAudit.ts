// @harness-uid u_eaaw6eeoc4
import type {
	VaultSecurityEvent,
	VaultSecurityVerdict,
	VaultSecurityWindow
} from './vaultSecurityAudit.types';

const alarming = new Set([
	'token-created',
	'oauth-grant',
	'recovery-changed',
	'mfa-changed',
	'password-changed'
]);

/**
 * Judges the account security log for a lease window. New tokens, grants, recovery, 2FA or
 * password changes and sessions the lease did not create are alerts. A missing log is never clean.
 */
export function vaultSecurityAudit(
	events: VaultSecurityEvent[] | null,
	window: VaultSecurityWindow
): VaultSecurityVerdict {
	if (events === null) {
		return { verdict: 'unverifiable', reason: 'The provider security log could not be read.' };
	}
	const inWindow = events.filter(({ at }) => at >= window.from && at <= window.to);
	const findings = inWindow.filter((event) => isFinding(event, window.leaseSessions));
	if (findings.length > 0) return { verdict: 'alert', findings };
	return { verdict: 'clean', checked: inWindow.length };
}

function isFinding(event: VaultSecurityEvent, leaseSessions: string[]): boolean {
	if (alarming.has(event.kind)) return true;
	if (event.kind !== 'session-created' && event.kind !== 'login') return false;
	return event.session === undefined || !leaseSessions.includes(event.session);
}
