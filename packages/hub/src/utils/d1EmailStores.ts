import type { EmailLedgerStore, EmailProofStore } from '../models/HubAuthStore.types';

export interface D1EmailStores {
	emailProofs: EmailProofStore;
	emailLedger: EmailLedgerStore;
}

export const EMAIL_PURGES = [
	'DELETE FROM auth_email_proofs WHERE expires_at <= ?',
	'DELETE FROM auth_email_verified WHERE expires_at <= ?',
	'DELETE FROM auth_email_sends WHERE last_sent_at + 172800000 <= ?'
];

export { d1EmailStores } from '../routes/api/[...path]/d1-auth-store-adapter/d1EmailStores';
