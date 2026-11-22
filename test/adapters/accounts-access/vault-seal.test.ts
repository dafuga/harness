import { createPrivateKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { VaultSealAdapter } from '../../../src/adapters/accounts-access/VaultSealAdapter';
import { FakePhone, randomNonce } from '../../support/credential-vault/phone';

const seal = new VaultSealAdapter();
const vector = JSON.parse(
	readFileSync(
		new URL('../../support/credential-vault/crypto-vector.json', import.meta.url),
		'utf8'
	)
);
const binding = {
	recipeDigest: 'a'.repeat(64),
	runnerFingerprint: 'b'.repeat(64),
	method: 'browser' as const,
	mode: 'read' as const,
	leaseMs: 900_000
};

test('the broker v1 vector still verifies and opens byte for byte', () => {
	const input = seal.deviceSigningInput(vector.origin, '/v1/device/decision', vector.proof);
	const key = seal.signingKey(vector.signerPublicKey);
	expect(seal.isAuthentic(key, input, vector.proof.signature)).toBe(true);
	const payload = JSON.parse(Buffer.from(vector.proof.payload, 'base64url').toString('utf8'));
	expect(payload.sessionKeyFingerprint).toBe(seal.keyFingerprint(vector.recipientPublicKey));
	const recipient = createPrivateKey({
		format: 'jwk',
		key: { kty: 'OKP', crv: 'X25519', x: vector.recipientPublicKey, d: vector.recipientPrivateKey }
	});
	const plain = seal.open(recipient, payload.requestId, payload.sealed);
	expect(JSON.parse(plain.toString())).toEqual({
		password: 'synthetic-swift-fixture',
		otp: '000123'
	});
});

test('a V2 approval signature covers the recipe digest, runner, method and lease scope', () => {
	const phone = new FakePhone();
	const origin = 'https://vault.example.test';
	const proof = phone.decide(
		origin,
		randomNonce(),
		{
			decision: 'deny',
			requestId: '0'.repeat(32),
			runnerFingerprint: binding.runnerFingerprint,
			recipeDigest: binding.recipeDigest
		},
		binding
	);
	const key = seal.signingKey(phone.signingKey);
	expect(
		seal.isAuthentic(key, seal.approvalSigningInput(origin, proof, binding), proof.signature)
	).toBe(true);
	for (const changed of [
		{ ...binding, recipeDigest: 'c'.repeat(64) },
		{ ...binding, runnerFingerprint: 'c'.repeat(64) },
		{ ...binding, method: 'api-token' as const },
		{ ...binding, mode: 'write' as const },
		{ ...binding, leaseMs: 3_600_000 }
	]) {
		expect(
			seal.isAuthentic(key, seal.approvalSigningInput(origin, proof, changed), proof.signature)
		).toBe(false);
	}
	const v1 = seal.deviceSigningInput(origin, '/v1/device/decision', proof);
	expect(seal.isAuthentic(key, v1, proof.signature)).toBe(false);
});

test('a runner key opens its envelope once and rejects another request id', () => {
	const runner = seal.runnerKey();
	const requestId = '1'.repeat(32);
	const sealed = seal.seal(runner.publicKey, requestId, Buffer.from('synthetic'));
	expect(() => seal.runnerKey().open('2'.repeat(32), sealed)).toThrow(
		'Could not open the phone approval.'
	);
	expect(runner.open(requestId, sealed).toString()).toBe('synthetic');
	expect(() => runner.open(requestId, sealed)).toThrow('already used');
});

test('a malformed device key is rejected', () => {
	expect(() => seal.signingKey(Buffer.alloc(65).toString('base64url'))).toThrow(
		'Invalid device key.'
	);
});
