import type { ExchangeStore } from '../../../../../models/accounts-access/HubAuthStore.types';
import type { SessionRepository } from '../../../../../repositories/projects-sessions/SessionRepository';
import type { AuthSecrets } from '../../../../../utils/verification-evidence/authSecrets';
import type { HubEnvironment } from '../../../../../models/accounts-access/HubAuth.types';

export interface NativeHandoffOptions {
	store: ExchangeStore;
	sessions: SessionRepository;
	secrets: AuthSecrets;
	origin: string;
	environment: HubEnvironment;
	now: () => number;
}
