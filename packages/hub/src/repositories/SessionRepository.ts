import type { Actor } from 'collaboration';
import type { SessionKind, SessionRecord, SessionStore } from '../models/HubAuthStore.types';
import { randomToken } from '../utils/authSecrets';
import type { AuthSecrets } from '../utils/authSecrets';

export const BROWSER_TTL = 7 * 24 * 60 * 60 * 1000;
export const NATIVE_TTL = 30 * 24 * 60 * 60 * 1000;

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

/** Opaque, server-revocable sessions. A credential is random bytes, never a signed claim set. */
export class SessionRepository {
	constructor(private readonly options: SessionRepositoryOptions) {}

	async issue(grant: SessionGrant): Promise<IssuedSession> {
		const credential = randomToken();
		const createdAt = this.options.now();
		const record: SessionRecord = {
			...grant,
			idHash: await this.options.secrets.hash('session', credential),
			createdAt,
			expiresAt: createdAt + (grant.kind === 'native' ? NATIVE_TTL : BROWSER_TTL),
			revokedAt: null
		};
		await this.options.store.create(record);
		return { credential, record };
	}

	/** The live session for a credential. Null once it is unknown, expired or revoked. */
	async find(credential: string): Promise<SessionRecord | null> {
		return this.live(await this.options.secrets.hash('session', credential));
	}

	async live(idHash: string): Promise<SessionRecord | null> {
		const record = await this.options.store.find(idHash);
		if (!record || record.revokedAt !== null) return null;
		return record.expiresAt > this.options.now() ? record : null;
	}

	/** Ends the session and every native session it approved. */
	async revoke(record: SessionRecord): Promise<void> {
		await this.options.store.revoke(record.idHash, this.options.now());
	}

	/** Ends every session issued from this origin, such as a pending email proof. */
	async revokeIssuedFrom(parentHash: string): Promise<void> {
		await this.options.store.revoke(parentHash, this.options.now());
	}
}
