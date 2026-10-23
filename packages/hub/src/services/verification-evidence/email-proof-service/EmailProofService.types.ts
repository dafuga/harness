import type { AuthStore } from '../../../models/accounts-access/HubAuthStore.types';
import type { EmailProofRecord } from '../../../models/accounts-access/HubAuthStore.types';
import type { SessionRepository } from '../../../repositories/projects-sessions/SessionRepository';
import type { AuthSecrets } from '../../../utils/verification-evidence/authSecrets';
import type { EmailProofDelivery } from '../../../models/accounts-access/HubAuth.types';

export interface EmailProofOptions {
	store: Pick<AuthStore, 'emailProofs' | 'emailLedger'>;
	sessions: SessionRepository;
	secrets: AuthSecrets;
	/** Null when no delivery is configured: a proof can then be opened but never started. */
	delivery: EmailProofDelivery | null;
	now: () => number;
}

export interface Pending {
	idHash: string;
	record: EmailProofRecord;
}
