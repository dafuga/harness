import type { ChallengeRecord, ExchangeStore, GithubStateRecord, OneTimeStore } from "../models/HubAuthStore.types";

export interface D1OneTimeStores {
	challenges: OneTimeStore<ChallengeRecord>;
	githubStates: OneTimeStore<GithubStateRecord>;
	exchanges: ExchangeStore;
}

export { d1OneTimeStores } from '../adapters/d1-auth-store-adapter/d1OneTimeStores';
