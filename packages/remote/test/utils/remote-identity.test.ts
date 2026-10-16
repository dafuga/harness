import { expect, test } from 'vitest';
import { fromBase64Url } from '../../src/utils/remoteBytes';
import {
	credentialHash,
	normalizeCode,
	pairingCode,
	pkceChallenge,
	randomCredential,
	randomId,
	remoteIdentity,
	remotePatterns,
	requestDigest
} from '../../src/utils/remoteIdentity';
import { vectors } from '../support/vectors';

test('an identity is the first 40 hex of the key hash, from bytes or base64url', async () => {
	expect(await remoteIdentity(vectors.hostStatic.publicKey)).toBe(vectors.hostId);
	expect(await remoteIdentity(fromBase64Url(vectors.deviceStatic.publicKey))).toBe(
		vectors.deviceId
	);
	await expect(remoteIdentity('AAAA')).rejects.toThrow();
	await expect(remoteIdentity(new Uint8Array(65))).rejects.toThrow();
});
test('a credential hash is bound to role, host and device', async () => {
	const { credential, hostHash, deviceHash } = vectors.credential,
		{ hostId, deviceId } = vectors;
	expect(await credentialHash({ role: 'host', hostId, credential })).toBe(hostHash);
	expect(await credentialHash({ role: 'device', hostId, deviceId, credential })).toBe(deviceHash);
	expect(await credentialHash({ role: 'device', hostId, deviceId: hostId, credential })).not.toBe(
		deviceHash
	);
	expect(hostHash).toMatch(remotePatterns.hash);
});
test('the PKCE challenge is S256 of the verifier (RFC 7636 appendix B)', async () => {
	expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
		'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
	);
});
test('generated identifiers, credentials and codes have their declared shapes', () => {
	expect(randomId()).toMatch(remotePatterns.pairingId);
	expect(randomId()).not.toBe(randomId());
	expect(randomCredential()).toMatch(remotePatterns.credential);
	const code = pairingCode();
	expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
	expect(normalizeCode(code)).toMatch(remotePatterns.code);
	expect(normalizeCode(' abcd-efgh ')).toBe('ABCDEFGH');
	expect(pairingCode()).not.toBe(code);
});
test('a request digest ignores key order and separates method from input', async () => {
	const digest = (method: 'startRun' | 'approve', input: Record<string, unknown>, id = 'x') =>
		requestDigest({ type: 'request', id, method, input });
	const first = await digest('startRun', { a: 1, b: { c: 2, d: 3 } });
	expect(first).toMatch(remotePatterns.hash);
	expect(await digest('startRun', { b: { d: 3, c: 2 }, a: 1 }, 'y')).toBe(first);
	expect(await digest('approve', { a: 1, b: { c: 2, d: 3 } })).not.toBe(first);
	expect(await digest('startRun', { a: 1, b: { c: 2, d: 4 } })).not.toBe(first);
});
