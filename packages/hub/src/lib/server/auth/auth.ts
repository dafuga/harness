import { createRemoteJWKSet } from 'jose';
import { createResendDelivery } from './ResendEmailAdapter';
import type { AuthEnv, EmailProofDelivery, HubAuth } from '../../../models/HubAuth.types';
import type { AuthStore } from '../../../models/HubAuthStore.types';
import { GOOGLE_JWKS_URL, GoogleIdentityService } from './GoogleIdentityService';
import type { CachedInstallationToken } from './installation-token-service/InstallationTokenService';
import { authConfig } from './authConfig';
import { authDisabled } from './authDisabled';
import { composeHubAuth } from './composeHubAuth';

/** Google's published signing keys, cached per isolate. No other key set is reachable from here. */
const googleKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Installation tokens live in isolate memory only, shared by every request of the isolate. */
const tokenCache = new Map<string, CachedInstallationToken>();

/**
 * Hub authentication for one environment. Pass the platform environment and the store; with a
 * missing value or a null store the result reports itself disabled and authenticates nobody.
 * `delivery` mails proof codes to addresses Google does not vouch for. By default it is the
 * Resend adapter when both email settings are present, and otherwise nothing.
 */
export function createHubAuth(
	env: AuthEnv,
	store: AuthStore | null,
	delivery: EmailProofDelivery | null = createResendDelivery(env)
): HubAuth {
	const config = authConfig(env);
	if (!config || !store) return authDisabled();
	const now = () => Date.now();
	const google = new GoogleIdentityService({ clientId: config.clientId, keys: googleKeys, now });
	const fetcher: typeof fetch = (input, init) => fetch(input, init);
	return composeHubAuth({ config, store, google, fetch: fetcher, now, tokenCache, delivery });
}

export { createD1AuthStore } from '../../../routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter';

export { createResendDelivery } from './ResendEmailAdapter';

export { type D1Like } from '../../../routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter';

export { AuthFailure } from '../../../utils/authFail';

export type * from '../../../models/HubAuth.types';

export type { AuthStore } from '../../../models/HubAuthStore.types';
