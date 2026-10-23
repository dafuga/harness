import type { OneTimeStore } from '../../models/accounts-access/HubAuthStore.types';
import type { ChallengeRecord } from '../../models/accounts-access/HubAuthStore.types';
import type { AuthSecrets } from '../../utils/verification-evidence/authSecrets';
import type { AuthChallenge } from '../../models/accounts-access/HubAuth.types';

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
