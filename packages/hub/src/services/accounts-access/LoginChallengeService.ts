import type { AuthChallenge } from '../../models/accounts-access/HubAuth.types';
import type {
	ChallengeRecord,
	OneTimeStore
} from '../../models/accounts-access/HubAuthStore.types';
import { authFail } from '../../utils/accounts-access/authFail';
import { randomToken, safeEqual } from '../../utils/verification-evidence/authSecrets';
import type { AuthSecrets } from '../../utils/verification-evidence/authSecrets';

export const CHALLENGE_TTL = 5 * 60 * 1000;

export interface LoginChallengeOptions {
	store: OneTimeStore<ChallengeRecord>;
	secrets: AuthSecrets;
	now: () => number;
}

export interface IssuedChallenge {
	/** Value for the HttpOnly challenge cookie. */
	cookie: string;
	challenge: AuthChallenge;
}

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
