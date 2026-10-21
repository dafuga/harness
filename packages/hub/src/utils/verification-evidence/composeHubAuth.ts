import type { EmailProofDelivery } from '../../models/accounts-access/HubAuth.types';
import type { AuthStore } from '../../models/accounts-access/HubAuthStore.types';
import type { GoogleIdentityService } from '../../lib/verification-evidence/server/auth/GoogleIdentityService';
import type { CachedInstallationToken } from '../../lib/verification-evidence/server/auth/installation-token-service/InstallationTokenService';
import type { AuthConfig } from './authConfig';

export interface HubAuthParts {
	config: AuthConfig;
	store: AuthStore;
	/** Built by the caller, so the key set it trusts is chosen in exactly one place. */
	google: GoogleIdentityService;
	fetch: typeof fetch;
	now: () => number;
	tokenCache: Map<string, CachedInstallationToken>;
	/** Null leaves Google accounts outside Gmail and Workspace unable to finish signing in. */
	delivery: EmailProofDelivery | null;
}

export { composeHubAuth } from '../../lib/verification-evidence/server/auth/composeHubAuth';
