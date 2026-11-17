import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { authSecrets } from '../../src/lib/verification-evidence/server/auth/authSecrets';
import {
	userCode,
	normalizeCode
} from '../../src/lib/verification-evidence/server/auth/native-handoff-service/authSecrets';
import { emailCode } from '../../src/services/verification-evidence/email-proof-service/authSecrets';
import {
	randomToken,
	sha256Url,
	safeEqual
} from '../../src/utils/verification-evidence/authSecrets';

type RecordMeta = Parameters<typeof recordExampleCases>[0];

const SECRET = 'q8Xr2TzV0mLbN4wJkP7YdHcF1sGaE9uR3iKxOyBtZ6M';
const OTHER_SECRET = 'a7c3e9f1b5d2a8c4e6f0b3d7a1c5e9f2b6d0a4c8e2f6b1d5a9c3e7f0b4d8a2c6';
const CONTEXT = 'session:42';
const PLAIN = 'fixture-refresh-value';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const HEX_A = '3f9a1c7e5b2d8f04a6c9e1b7d3f5a8c2e0b4d6f9a1c3e5b7d9f2a4c6e8b0d1f3';
const HEX_B = '3f9a1c7e5b2d8f04a6c9e1b7d3f5a8c2e0b4d6f9a1c3e5b7d9f2a4c6e8b0d1f4';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

function meta(state: string, symbol: string): RecordMeta {
	return {
		unitId: 'hub.function.auth-secrets',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Hashes purposes with a keyed lookup', async () => {
	const secrets = authSecrets(SECRET);
	const hash = await secrets.hash('session-lookup', 'fixture-token-7');
	const again = await secrets.hash('session-lookup', 'fixture-token-7');
	const otherPurpose = await secrets.hash('email-lookup', 'fixture-token-7');
	const otherSecret = await authSecrets(OTHER_SECRET).hash('session-lookup', 'fixture-token-7');
	expect(hash).toMatch(/^[0-9a-f]{64}$/);
	expect(again).toBe(hash);
	expect(otherPurpose).not.toBe(hash);
	expect(otherSecret).not.toBe(hash);
	recordExampleCases(meta('hashes-purposes-with-a-keyed-lookup', 'hash'), [
		{
			name: 'same secret, purpose and value',
			input: { purpose: 'session-lookup', value: 'fixture-token-7' },
			output: { hash, repeatable: again === hash }
		},
		{
			name: 'different purpose for the same value',
			input: { purpose: 'email-lookup', value: 'fixture-token-7' },
			output: { differs: otherPurpose !== hash }
		},
		{
			name: 'different secret for the same purpose and value',
			input: { secret: OTHER_SECRET, purpose: 'session-lookup', value: 'fixture-token-7' },
			output: { differs: otherSecret !== hash }
		}
	]);
});

test('Seals values and opens them only under the same key', async () => {
	const secrets = authSecrets(SECRET);
	const sealed = await secrets.seal(PLAIN, CONTEXT);
	const resealed = await secrets.seal(PLAIN, CONTEXT);
	const opened = await secrets.open(sealed, CONTEXT);
	const wrongContext = await secrets.open(sealed, 'session:43');
	const wrongSecret = await authSecrets(OTHER_SECRET).open(sealed, CONTEXT);
	expect(sealed.split('.')).toHaveLength(3);
	expect(resealed).not.toBe(sealed);
	expect(opened).toBe(PLAIN);
	expect(wrongContext).toBeNull();
	expect(wrongSecret).toBeNull();
	recordExampleCases(meta('seals-values-and-opens-them-only-under-the-same-key', 'seal'), [
		{
			name: 'seals with a fresh IV each time',
			input: { plain: PLAIN, context: CONTEXT },
			output: { parts: sealed.split('.').length, version: 'v1', freshIv: resealed !== sealed }
		},
		{
			name: 'opens under the same secret and context',
			input: { sealed, context: CONTEXT },
			output: opened
		},
		{
			name: 'context differs from the sealed one',
			input: { sealed, context: 'session:43' },
			output: null
		},
		{
			name: 'envelope sealed under another secret',
			input: { sealed, context: CONTEXT, secret: OTHER_SECRET },
			output: null
		}
	]);
});

test('Encodes random tokens and PKCE challenges', async () => {
	const token = randomToken();
	const short = randomToken(16);
	const challenge = await sha256Url(VERIFIER);
	expect(token).toHaveLength(43);
	expect(short).toHaveLength(22);
	expect(challenge).toBe(CHALLENGE);
	expect(() => randomToken(-1)).toThrow(RangeError);
	recordExampleCases(meta('encodes-random-tokens-and-pkce-challenges', 'randomToken'), [
		{
			name: 'default 32 bytes give an unpadded token',
			input: { bytes: 32 },
			output: { length: token.length, padded: token.includes('=') }
		},
		{
			name: '16 bytes give a 22-character token',
			input: { bytes: 16 },
			output: { length: short.length }
		},
		{
			name: 'negative byte count is rejected',
			input: { bytes: -1 },
			error: 'RangeError'
		},
		{
			name: 'PKCE code_verifier gives its S256 code_challenge',
			input: { value: VERIFIER },
			output: challenge
		}
	]);
});

test('Builds and normalizes user entered codes', () => {
	const code = userCode();
	expect(code).toMatch(CODE_PATTERN);
	expect(normalizeCode('k7qf-9mbw')).toBe('K7QF9MBW');
	expect(normalizeCode('3HDX PTY6')).toBe('3HDXPTY6');
	expect(normalizeCode('ı')).toBe('I');
	recordExampleCases(meta('builds-and-normalizes-user-entered-codes', 'userCode'), [
		{
			name: 'generates two groups of four characters',
			input: {},
			output: { length: code.length, groupLengths: code.split('-').map((g) => g.length) }
		},
		{
			name: 'normalizes hyphen and lowercase input',
			input: { value: 'k7qf-9mbw' },
			output: normalizeCode('k7qf-9mbw')
		},
		{
			name: 'normalizes a space-separated code',
			input: { value: '3HDX PTY6' },
			output: normalizeCode('3HDX PTY6')
		},
		{
			name: 'keeps a dotless i that uppercases to I',
			input: { value: 'ı' },
			output: normalizeCode('ı')
		}
	]);
});

test('Generates eight digit email codes', () => {
	const digits = emailCode();
	expect(digits).toMatch(/^\d{8}$/);
	recordExampleCases(meta('generates-eight-digit-email-codes', 'emailCode'), [
		{
			name: 'generates eight decimal digits',
			input: {},
			output: { length: digits.length, digitsOnly: /^\d+$/.test(digits) }
		}
	]);
});

test('Compares strings for equality without early exit', () => {
	const short = HEX_A.slice(0, 10);
	expect(safeEqual(HEX_A, HEX_A)).toBe(true);
	expect(safeEqual(HEX_A, HEX_B)).toBe(false);
	expect(safeEqual(HEX_A, short)).toBe(false);
	recordExampleCases(meta('compares-strings-for-equality-without-early-exit', 'safeEqual'), [
		{
			name: 'equal 64-character hex strings',
			input: { left: HEX_A, right: HEX_A },
			output: true
		},
		{
			name: 'differs only in the last character',
			input: { left: HEX_A, right: HEX_B },
			output: false
		},
		{
			name: 'unequal lengths return false',
			input: { left: HEX_A, right: short },
			output: false
		}
	]);
});
