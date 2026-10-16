import { SignJWT, createLocalJWKSet, exportJWK, exportSPKI, generateKeyPair } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';

export const CLIENT_ID = 'synthetic-client.apps.googleusercontent.com';
export const KEY_ID = 'synthetic-google-key';
/** A Google account on an address Google does not vouch for: no Gmail, no Workspace `hd`. */
export const LIN = { sub: '330000000000000000003', email: 'lin@example.org', name: 'Lin Example' };
export const START = Date.UTC(2026, 9, 12, 9, 0, 0);

type Claims = JWTPayload & Record<string, unknown>;

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

async function rs256(claims: Claims, key: CryptoKey): Promise<string> {
	return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: KEY_ID }).sign(key);
}

const pairs = Promise.all([
	generateKeyPair('RS256', { extractable: true }),
	generateKeyPair('RS256', { extractable: true })
]);

/** Real RSA keys, generated once per test file. Nothing here stubs verification. */
export async function googleFixture(now: () => number): Promise<GoogleFixture> {
	const [trusted, other] = await pairs;
	const jwk = { ...(await exportJWK(trusted.publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' };
	return {
		keys: createLocalJWKSet({ keys: [jwk] }),
		jwks: { keys: [jwk] },
		publicPem: await exportSPKI(trusted.publicKey),
		claims(nonce, overrides = {}) {
			const seconds = Math.floor(now() / 1000);
			return {
				iss: 'https://accounts.google.com',
				aud: CLIENT_ID,
				azp: CLIENT_ID,
				sub: '110000000000000000001',
				email: 'ada@gmail.com',
				email_verified: true,
				name: 'Ada Example',
				nonce,
				iat: seconds,
				exp: seconds + 3600,
				...overrides
			};
		},
		sign: (claims) => rs256(claims, trusted.privateKey),
		forge: (claims) => rs256(claims, other.privateKey)
	};
}
