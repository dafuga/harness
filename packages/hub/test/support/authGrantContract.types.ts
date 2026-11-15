import type { AuthStore } from '../../src/models/accounts-access/HubAuthStore.types';

export type Create = () => Promise<AuthStore>;
