import { expect, test } from 'vitest';
import { authSecrets } from '../../src/lib/server/auth/authSecrets';
import { emailCode } from '../../src/services/email-proof-service/authSecrets';
import { normalizeCode, userCode } from '../../src/services/native-handoff-service/authSecrets';
import { randomToken, safeEqual, sha256Url } from '../../src/utils/authSecrets';

const secret = 'synthetic-session-secret-0123456789abcdef';

test('authSecrets hashes by purpose and key, never returning the value', async () => {
	const secrets = authSecrets(secret);
	const hash = await secrets.hash('session', 'opaque-value');
	expect(hash).toMatch(/^[a-f0-9]{64}$/);
	expect(hash).toBe(await secrets.hash('session', 'opaque-value'));
	expect(hash).not.toBe(await secrets.hash('challenge', 'opaque-value'));
	expect(hash).not.toBe(await authSecrets(`${secret}x`).hash('session', 'opaque-value'));
});

test('authSecrets seals with AES-GCM bound to its context and key', async () => {
	const secrets = authSecrets(secret);
	const sealed = await secrets.seal('ghu_synthetic', 'grant:google-1');
	expect(sealed).not.toContain('ghu_synthetic');
	expect(await secrets.open(sealed, 'grant:google-1')).toBe('ghu_synthetic');
	expect(await secrets.open(sealed, 'grant:google-2')).toBeNull();
	expect(await authSecrets(`${secret}x`).open(sealed, 'grant:google-1')).toBeNull();
	expect(await secrets.seal('ghu_synthetic', 'grant:google-1')).not.toBe(sealed);
});

test('authSecrets rejects a tampered or malformed sealed value', async () => {
	const secrets = authSecrets(secret);
	const sealed = await secrets.seal('ghu_synthetic', 'grant:google-1');
	const [version, iv, data] = sealed.split('.');
	const flipped = `${version}.${iv}.${data.startsWith('A') ? 'B' : 'A'}${data.slice(1)}`;
	expect(await secrets.open(flipped, 'grant:google-1')).toBeNull();
	expect(await secrets.open('v1.only-two', 'grant:google-1')).toBeNull();
	expect(await secrets.open(`v2.${sealed.slice(3)}`, 'grant:google-1')).toBeNull();
});

test('sha256Url produces the RFC 7636 S256 challenge', async () => {
	expect(await sha256Url('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
		'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
	);
});

test('random values are unguessable and compared without early exit on content', () => {
	expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
	expect(randomToken()).not.toBe(randomToken());
	expect(safeEqual('abc', 'abc')).toBe(true);
	expect(safeEqual('abc', 'abd')).toBe(false);
	expect(safeEqual('abc', 'abcd')).toBe(false);
});

test('user codes avoid ambiguous characters and normalize typed input', () => {
	const code = userCode();
	expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
	expect(normalizeCode(` ${code.toLowerCase().replace('-', ' ')} `)).toBe(code.replace('-', ''));
});

test('email codes are eight digits and keep their leading zeros', () => {
	const codes = Array.from({ length: 200 }, () => emailCode());
	for (const code of codes) expect(code).toMatch(/^[0-9]{8}$/);
	expect(new Set(codes).size).toBeGreaterThan(190);
});
