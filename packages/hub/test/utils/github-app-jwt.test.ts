import { generateKeyPairSync } from 'node:crypto';
import { importSPKI, jwtVerify } from 'jose';
import { expect, test } from 'vitest';
import {
	githubAppJwt,
	githubAppKey
} from '../../src/services/installation-token-service/githubAppJwt';

const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pkcs1 = pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const pkcs8 = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = Date.UTC(2026, 9, 12, 9, 0, 0);

async function verified(pem: string) {
	const jwt = await githubAppJwt({ appId: '4242', key: await githubAppKey(pem), now });
	const key = await importSPKI(publicPem, 'RS256');
	return jwtVerify(jwt, key, { algorithms: ['RS256'], currentDate: new Date(now) });
}

test('githubAppJwt signs RS256 with the PEM GitHub issues and with PKCS#8', async () => {
	expect(pkcs1).toContain('BEGIN RSA PRIVATE KEY');
	for (const pem of [pkcs1, pkcs8, pkcs1.replace(/\n/g, '\\n')]) {
		const { payload, protectedHeader } = await verified(pem);
		expect(protectedHeader.alg).toBe('RS256');
		expect(payload.iss).toBe('4242');
	}
});

test('githubAppJwt is back-dated a minute and lives at most ten', async () => {
	const { payload } = await verified(pkcs1);
	const seconds = Math.floor(now / 1000);
	expect(payload.iat).toBe(seconds - 60);
	expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(600);
	expect(payload.exp!).toBeLessThanOrEqual(seconds + 600);
	expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'iss']);
});

test('githubAppKey keeps the key unextractable and refuses anything that is not an RSA key', async () => {
	expect((await githubAppKey(pkcs1)).extractable).toBe(false);
	await expect(githubAppKey('not a key')).rejects.toThrow('Hub auth github-disabled');
	await expect(githubAppKey(publicPem)).rejects.toThrow('Hub auth github-disabled');
	const body = pkcs1.split('\n').slice(1, -2).join('');
	const truncated = `-----BEGIN RSA PRIVATE KEY-----\n${body.slice(0, 40)}\n-----END RSA PRIVATE KEY-----`;
	await expect(githubAppKey(truncated)).rejects.toThrow('Hub auth github-disabled');
});
