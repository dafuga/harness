import { createPrivateKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	githubAppKey,
	githubAppJwt
} from '../../src/lib/verification-evidence/server/auth/installation-token-service/githubAppJwt';
import type { Sample, KeyPair } from './hub.function.github-app-jwt.test.types';

const UNIT_ID = 'hub.function.github-app-jwt';
const APP_ID = '123456';
const NOW = 1794744000517;
const UNIMPORTABLE_PEM = '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----';
const SIGNING_SAMPLES: Sample[] = [
	{ appId: APP_ID, now: NOW },
	{ appId: '2231874', now: 1794745812004 }
];
const SIGNED_KEY_SUMMARY = {
	algorithm: 'RSASSA-PKCS1-v1_5',
	extractable: false,
	type: 'private',
	usages: ['sign']
};

function meta(symbol: string, state: string) {
	return { unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function makeKeyPair(): KeyPair {
	const pair = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: { type: 'spki', format: 'pem' },
		privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
	});
	const pkcs8 = createPrivateKey(pair.privateKey).export({ type: 'pkcs8', format: 'pem' });
	return {
		pkcs1: pair.privateKey.toString(),
		pkcs8: pkcs8.toString(),
		publicKey: pair.publicKey.toString()
	};
}

function summarizeKey(key: CryptoKey) {
	return {
		algorithm: key.algorithm.name,
		extractable: key.extractable,
		type: key.type,
		usages: key.usages
	};
}

function decodePart(part: string): Record<string, unknown> {
	return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function summarizeJwt(jwt: string, publicKey: string) {
	const [header, claims] = jwt.split('.').slice(0, 2).map(decodePart);
	const [head, body, signature] = jwt.split('.');
	const verifier = createVerify('RSA-SHA256');
	verifier.update(`${head}.${body}`);
	const verified = verifier.verify(publicKey, Buffer.from(signature, 'base64url'));
	return { header, claims, verified };
}

async function failureOf(attempt: Promise<unknown>) {
	try {
		await attempt;
	} catch (error) {
		const failure = error as { code?: unknown; status?: unknown; message?: unknown };
		return { code: failure.code, status: failure.status, message: failure.message };
	}
	return { code: 'resolved', status: null, message: null };
}

test('Imports PKCS1 and PKCS8 app keys as sign-only', async () => {
	const keys = makeKeyPair();
	const fromPkcs1 = await githubAppKey(keys.pkcs1.replace(/\n/g, '\\n'));
	const fromPkcs8 = await githubAppKey(`\n  ${keys.pkcs8}  \n`);
	expect(summarizeKey(fromPkcs1)).toEqual(SIGNED_KEY_SUMMARY);
	expect(summarizeKey(fromPkcs8)).toEqual(SIGNED_KEY_SUMMARY);
	recordExampleCases(meta('githubAppKey', 'imports-pkcs1-and-pkcs8-app-keys-as-sign-only'), [
		{
			name: 'PKCS#1 block with backslash-n line breaks',
			input: { label: 'RSA PRIVATE KEY', lineBreaks: 'escaped' },
			output: SIGNED_KEY_SUMMARY
		},
		{
			name: 'PKCS#8 block with surrounding whitespace',
			input: { label: 'PRIVATE KEY', lineBreaks: 'real' },
			output: SIGNED_KEY_SUMMARY
		}
	]);
});

test('Rejects text outside the key block or an unimportable key', async () => {
	const outside = await failureOf(githubAppKey(`key: ${UNIMPORTABLE_PEM}`));
	const unimportable = await failureOf(githubAppKey(UNIMPORTABLE_PEM));
	const expected = { code: 'github-disabled', status: 503, message: 'Hub auth github-disabled' };
	expect(outside).toEqual(expected);
	expect(unimportable).toEqual(expected);
	recordExampleCases(
		meta('githubAppKey', 'rejects-text-outside-the-key-block-or-an-unimportable-key'),
		[
			{
				name: 'text precedes the PEM block',
				input: { pem: `key: ${UNIMPORTABLE_PEM}` },
				error: expected
			},
			{
				name: 'PKCS#8 block whose body WebCrypto cannot import',
				input: { pem: UNIMPORTABLE_PEM },
				error: expected
			}
		]
	);
});

test('Signs RS256 JWTs valid from one minute back to nine ahead', async () => {
	const keys = makeKeyPair();
	const key = await githubAppKey(keys.pkcs8);
	const tokens = await Promise.all(
		SIGNING_SAMPLES.map((sample) => githubAppJwt({ ...sample, key }))
	);
	const summaries = tokens.map((jwt) => summarizeJwt(jwt, keys.publicKey));
	expect(summaries[0]).toEqual({
		header: { alg: 'RS256', typ: 'JWT' },
		claims: { iss: APP_ID, iat: 1794743940, exp: 1794744540 },
		verified: true
	});
	expect(summaries[1]).toEqual({
		header: { alg: 'RS256', typ: 'JWT' },
		claims: { iss: '2231874', iat: 1794745752, exp: 1794746352 },
		verified: true
	});
	recordExampleCases(
		meta('githubAppJwt', 'signs-rs256-jwts-valid-from-one-minute-back-to-nine-ahead'),
		SIGNING_SAMPLES.map((sample, index) => ({
			name: `app ${sample.appId} at ${sample.now}`,
			input: sample,
			output: summaries[index]
		}))
	);
});
