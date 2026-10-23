import type { SessionStore } from '../../models/accounts-access/HubAuthStore.types';
import type { SessionKind } from '../../models/accounts-access/HubAuthStore.types';
import type { SessionRecord } from '../../models/accounts-access/HubAuthStore.types';
import type { AuthSecrets } from '../../utils/verification-evidence/authSecrets';
import type { Actor } from 'collaboration';

export interface SessionRepositoryOptions {
	store: SessionStore;
	secrets: AuthSecrets;
	now: () => number;
}

export interface SessionGrant {
	kind: SessionKind;
	actor: Actor;
	resource: string;
	parentHash: string | null;
}

export interface IssuedSession {
	/** Shown to its holder once. Only a keyed hash of it is stored. */
	credential: string;
	record: SessionRecord;
}
