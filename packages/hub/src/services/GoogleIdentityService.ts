import { jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';
import type { Actor } from 'collaboration';
import { authFail } from '../utils/authFail';
import { safeEqual } from '../utils/authSecrets';

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

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

const SUBJECT = /^[A-Za-z0-9._-]{1,128}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

function verifiedEmail(payload: JWTPayload): string | null {
	if (payload.email_verified !== true || typeof payload.email !== 'string') return null;
	const email = payload.email.toLowerCase();
	return EMAIL.test(email) ? email : null;
}

/**
 * Google is authoritative for Gmail addresses and for Workspace accounts (`hd` set). For any
 * other address Google says ownership may have changed since it was verified, so the caller has
 * to have the mailbox proven before the identity becomes an actor.
 */
function authoritative(email: string, payload: JWTPayload): boolean {
	const workspace = typeof payload.hd === 'string' && payload.hd.length > 0;
	return email.endsWith('@gmail.com') || workspace;
}

function displayName(payload: JWTPayload, email: string): string {
	const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 200) : '';
	return name || email.split('@')[0];
}

export class GoogleIdentityService {
	constructor(private readonly options: GoogleIdentityOptions) {}

	/** Signature, issuer, audience, expiry, nonce, subject and a verified email, or it throws. */
	async verify(credential: string, nonce: string): Promise<GoogleIdentity> {
		const payload = await this.signed(credential);
		const subject = typeof payload.sub === 'string' ? payload.sub : '';
		const email = verifiedEmail(payload);
		if (!this.bound(payload, nonce) || !SUBJECT.test(subject) || !email) {
			return authFail('credential-invalid');
		}
		const name = displayName(payload, email);
		const actor: Actor = { id: `google-${subject}`, email, name, emailVerified: true };
		return { actor, authoritative: authoritative(email, payload) };
	}

	private async signed(credential: string): Promise<JWTPayload> {
		try {
			const { payload } = await jwtVerify(credential, this.options.keys, {
				algorithms: ['RS256'],
				issuer: GOOGLE_ISSUERS,
				audience: this.options.clientId,
				currentDate: new Date(this.options.now()),
				clockTolerance: 10,
				requiredClaims: ['iss', 'aud', 'exp', 'sub', 'nonce']
			});
			return payload;
		} catch {
			return authFail('credential-invalid');
		}
	}

	/** A single audience, this client as authorized party, and the nonce this server issued. */
	private bound(payload: JWTPayload, nonce: string): boolean {
		if (payload.aud !== this.options.clientId) return false;
		if (payload.azp !== undefined && payload.azp !== this.options.clientId) return false;
		return typeof payload.nonce === 'string' && safeEqual(payload.nonce, nonce);
	}
}
