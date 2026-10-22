import type { SessionStore } from '../../models/accounts-access/HubAuthStore.types';

export interface D1CredentialStores {
	sessions: SessionStore;
}

export { d1CredentialStores } from '../../routes/api/[...path]/d1-auth-store-adapter/d1CredentialStores';
