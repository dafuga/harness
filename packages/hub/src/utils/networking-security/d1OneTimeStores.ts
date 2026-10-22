import type {
	ChallengeRecord,
	ExchangeStore,
	GithubStateRecord,
	OneTimeStore
} from '../../models/accounts-access/HubAuthStore.types';

export interface D1OneTimeStores {
	challenges: OneTimeStore<ChallengeRecord>;
	githubStates: OneTimeStore<GithubStateRecord>;
	exchanges: ExchangeStore;
}

export { d1OneTimeStores } from '../../routes/api/[...path]/d1-auth-store-adapter/d1OneTimeStores';
