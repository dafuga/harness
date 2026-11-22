// @harness-uid u_fjkcftdpdm
import type { VaultOtpChannel } from './vaultRecipe.types';
import type { VaultOtpChallenge, VaultOtpPlan } from './vaultOtpRoute.types';

export const vaultOtpLimits = { totpStepMs: 30_000, entryMs: 300_000, attempts: 3 } as const;

/**
 * Routes a one-time-code challenge. Every code is collected on Daniel's phone in Harness iOS and
 * sealed to the runner; SMS is never forwarded through a relay, Twilio or the box, and Harness
 * never reads the mailbox.
 */
export function vaultOtpRoute(
	channels: VaultOtpChannel[],
	challenge: VaultOtpChallenge
): VaultOtpPlan {
	if (!channels.includes(challenge.kind)) {
		return {
			route: 'stop',
			reason: 'The recipe does not allow a ' + challenge.kind + ' challenge.'
		};
	}
	const expiresAt = challenge.issuedAt + vaultOtpLimits.entryMs;
	if (challenge.kind === 'totp') {
		const step = vaultOtpLimits.totpStepMs;
		return {
			route: 'phone-totp',
			sealed: true,
			expiresAt: (Math.floor(challenge.issuedAt / step) + 1) * step
		};
	}
	if (challenge.kind === 'sms' || challenge.kind === 'email') {
		return {
			route: 'phone-entry',
			source: challenge.kind,
			sealed: true,
			autofill: challenge.kind === 'sms',
			acceptsLink: challenge.kind === 'email',
			attempts: vaultOtpLimits.attempts,
			expiresAt
		};
	}
	return { route: 'device-confirm', kind: challenge.kind, sealed: false, expiresAt };
}
