import { SignJWT } from 'jose';
import { authFail } from './authFail';

const PEM = /^-----BEGIN (RSA PRIVATE KEY|PRIVATE KEY)-----([A-Za-z0-9+/=\s]+)-----END \1-----$/;
/** AlgorithmIdentifier: rsaEncryption (1.2.840.113549.1.1.1) with NULL parameters. */
const RSA_ALGORITHM = [
	0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
];
const SIGNING = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

export interface GithubAppJwtInput {
	appId: string;
	key: CryptoKey;
	now: number;
}

function derLength(length: number): number[] {
	if (length < 0x80) return [length];
	const bytes: number[] = [];
	for (let rest = length; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
	return [0x80 | bytes.length, ...bytes];
}

/** Wraps a PKCS#1 RSAPrivateKey in the PKCS#8 PrivateKeyInfo that WebCrypto imports. */
function pkcs8(pkcs1: Uint8Array): Uint8Array<ArrayBuffer> {
	const body = [0x02, 0x01, 0x00, ...RSA_ALGORITHM, 0x04, ...derLength(pkcs1.length), ...pkcs1];
	return Uint8Array.from([0x30, ...derLength(body.length), ...body]);
}

/**
 * Imports the app's private key without making it extractable. Accepts the PKCS#1 PEM that
 * GitHub downloads, or PKCS#8, with real or `\n`-escaped line breaks.
 */
export async function githubAppKey(pem: string): Promise<CryptoKey> {
	const match = PEM.exec(pem.replace(/\\n/g, '\n').trim());
	if (!match) return authFail('github-disabled');
	try {
		const der = Uint8Array.from(atob(match[2].replace(/\s/g, '')), (char) => char.charCodeAt(0));
		const info = match[1] === 'RSA PRIVATE KEY' ? pkcs8(der) : der;
		return await crypto.subtle.importKey('pkcs8', info, SIGNING, false, ['sign']);
	} catch {
		return authFail('github-disabled');
	}
}

/** RS256, issued a minute in the past for clock drift and valid nine more: GitHub allows ten. */
export async function githubAppJwt(input: GithubAppJwtInput): Promise<string> {
	const seconds = Math.floor(input.now / 1000);
	return new SignJWT({})
		.setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
		.setIssuer(input.appId)
		.setIssuedAt(seconds - 60)
		.setExpirationTime(seconds + 540)
		.sign(input.key);
}
