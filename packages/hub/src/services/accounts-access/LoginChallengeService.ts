import type { LoginChallengeOptions, IssuedChallenge } from './LoginChallengeService.types';
import { authFail } from '../../utils/accounts-access/authFail';
import { randomToken, safeEqual } from '../../utils/verification-evidence/authSecrets';

export const CHALLENGE_TTL = 5 * 60 * 1000;

/** Binds one sign-in attempt to one browser: a cookie half, a CSRF half and a Google nonce. */
export class LoginChallengeService {
	constructor(private readonly options: LoginChallengeOptions) {}

	async issue(): Promise<IssuedChallenge> {
		const { store, secrets, now } = this.options;
		const cookie = randomToken();
		const challenge = { nonce: randomToken(), csrf: randomToken() };
		await store.create({
			idHash: await secrets.hash('challenge', cookie),
			nonce: challenge.nonce,
			csrfHash: await secrets.hash('csrf', challenge.csrf),
			expiresAt: now() + CHALLENGE_TTL
		});
		return { cookie, challenge };
	}

	/** Claims the challenge first, so an attempt spends it whether or not it then succeeds. */
	async consume(cookie: string | null, csrf: string): Promise<string> {
		const { store, secrets, now } = this.options;
		if (!cookie) return authFail('challenge-invalid');
		const record = await store.claim(await secrets.hash('challenge', cookie), now());
		const matches = record && safeEqual(record.csrfHash, await secrets.hash('csrf', csrf));
		return matches ? record.nonce : authFail('challenge-invalid');
	}
}

export type { LoginChallengeOptions, IssuedChallenge } from './LoginChallengeService.types';
