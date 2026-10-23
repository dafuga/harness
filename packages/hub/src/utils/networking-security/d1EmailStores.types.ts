import type { EmailProofStore } from '../../models/accounts-access/HubAuthStore.types';
import type { EmailLedgerStore } from '../../models/accounts-access/HubAuthStore.types';

export interface D1EmailStores {
	emailProofs: EmailProofStore;
	emailLedger: EmailLedgerStore;
}
