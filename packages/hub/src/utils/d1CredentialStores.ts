import type { SessionStore } from "../models/HubAuthStore.types";

export interface D1CredentialStores {
	sessions: SessionStore;
}

export { d1CredentialStores } from '../adapters/d1-auth-store-adapter/d1CredentialStores';
