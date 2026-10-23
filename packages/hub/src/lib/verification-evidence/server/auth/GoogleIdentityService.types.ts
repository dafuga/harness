import type { Actor } from 'collaboration';
import type { JWTVerifyGetKey } from 'jose';

export interface GoogleIdentity {
	/** Keyed by Google's subject. An actor outright only when `authoritative`. */
	actor: Actor;
	/** Gmail or Workspace: Google vouches for the mailbox today. */
	authoritative: boolean;
}

export interface GoogleIdentityOptions {
	clientId: string;
	/** Production passes Google's remote key set. Tests pass a local set of real RSA keys. */
	keys: JWTVerifyGetKey;
	now: () => number;
}
