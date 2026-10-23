import type { JWTPayload } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

export type Claims = JWTPayload & Record<string, unknown>;

export interface GoogleFixture {
	/** The verifier's key set: only the public half of the signing key. */
	keys: JWTVerifyGetKey;
	/** The same public key as a JWKS document, as Google's certs endpoint would serve it. */
	jwks: { keys: object[] };
	publicPem: string;
	claims(nonce: string, overrides?: Claims): Claims;
	/** RS256 with the key the verifier trusts. */
	sign(claims: Claims): Promise<string>;
	/** RS256 with another key that reuses the trusted key id. */
	forge(claims: Claims): Promise<string>;
}
