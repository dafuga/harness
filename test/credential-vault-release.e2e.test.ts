import { execFileSync } from 'node:child_process';
import {
	createDecipheriv,
	createHash,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync
} from 'node:crypto';
import { readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTempDirectory } from './support/temporary';
import type {
	PhoneDecision,
	QueuedRequestFlags,
	SavedLogin,
	SealedApproval
} from './credential-vault-release.e2e.test.types';

const darwin = process.platform === 'darwin';
let workspace = '';
let binary = '';
const core = 'packages/desktop/ios/App/App/Vault/Core';
const origin = 'https://broker.example';
const requestId = '00112233445566778899aabbccddeeff';
const selectionId = 'ffeeddccbbaa99887766554433221100';
const session = generateKeyPairSync('x25519');
const sessionPublicKey = session.publicKey.export({ format: 'jwk' }).x!;
const login: SavedLogin = { domain: 'github.com', password: 'synthetic-password' };

function approve(flags: QueuedRequestFlags, saved?: SavedLogin, code?: string): PhoneDecision {
	const request = {
		requestId,
		itemId: 'demo01',
		session: 'Synthetic',
		service: 'github',
		action: 'automation-login',
		reason: 'Synthetic release',
		expiresAt: 2_000_000,
		sessionPublicKey,
		sessionKeyFingerprint: createHash('sha256')
			.update(Buffer.from(sessionPublicKey, 'base64url'))
			.digest('hex'),
		command: { executable: '/usr/bin/true', args: [], cwd: '/tmp' },
		...flags
	};
	const input = JSON.stringify({ request, login: saved, code, expiresAt: 1_000_000, origin });
	return JSON.parse(execFileSync(binary, { input, encoding: 'utf8' })) as PhoneDecision;
}

/** Opens an envelope the way the requesting client does. */
function open(sealed: SealedApproval): unknown {
	const sender = createPublicKey({
		format: 'jwk',
		key: { kty: 'OKP', crv: 'X25519', x: sealed.senderPublicKey }
	});
	const shared = diffieHellman({ privateKey: session.privateKey, publicKey: sender });
	const salt = Buffer.from(sealed.salt, 'base64url');
	const key = Buffer.from(hkdfSync('sha256', shared, salt, 'credential-broker/seal/v1', 32));
	const bytes = Buffer.from(sealed.ciphertext, 'base64url');
	const cipher = createDecipheriv('chacha20-poly1305', key, Buffer.alloc(12), {
		authTagLength: 16
	});
	cipher.setAAD(Buffer.from(requestId, 'ascii'), { plaintextLength: bytes.length - 16 });
	cipher.setAuthTag(bytes.subarray(-16));
	return JSON.parse(
		Buffer.concat([cipher.update(bytes.subarray(0, -16)), cipher.final()]).toString()
	);
}

beforeAll(async () => {
	if (!darwin) return;
	workspace = await createTempDirectory('vault-release-');
	binary = join(workspace, 'release');
	const sources = readdirSync(core)
		.filter((name) => name.endsWith('.swift'))
		.map((name) => join(core, name));
	const driver = 'test/support/credential-vault/iosRelease.swift';
	execFileSync('xcrun', ['swiftc', ...sources, driver, '-parse-as-library', '-o', binary]);
}, 240_000);
afterAll(async () => {
	if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe.skipIf(!darwin)('Harness iOS approvals for the live broker', () => {
	test('a deferred sign-in releases the password and keeps the code for later', () => {
		const result = approve({ deferredOtp: true }, login, '123456');
		expect(open(result.sealed!)).toEqual({ password: login.password, otp: null });
		expect(result).not.toHaveProperty('otpIncluded');
		expect(result).not.toHaveProperty('codeOnly');
		expect(result).not.toHaveProperty('environment');
	});

	test('the later code request sends only a fresh code', () => {
		const result = approve({ codeOnly: true, requireServiceOtp: true }, login, ' 654321 ');
		expect(result).toMatchObject({ decision: 'approve', codeOnly: true, otpIncluded: true });
		expect(open(result.sealed!)).toEqual({ password: null, otp: '654321' });
		expect(approve({ codeOnly: true, requireServiceOtp: true }).refused).toBe('codeRequired');
	});

	test('an offer with a selection ID is approved for that offer and broker', () => {
		expect(approve({ selectionId }, login).environment).toEqual({ selectionId, origin });
		const only = approve({ approvalOnly: true, selectionId });
		expect(only).toMatchObject({ decision: 'approve', approvalOnly: true });
		expect(only).not.toHaveProperty('sealed');
		expect(only).not.toHaveProperty('environment');
	});

	test('a website-bound password goes only to a login saved for that website', () => {
		const bound = { websiteDomain: 'github.com' };
		expect(open(approve(bound, login).sealed!)).toEqual({
			password: login.password,
			otp: null,
			websiteDomain: 'github.com'
		});
		for (const domain of ['gist.github.com', 'github.com.evil.example', undefined])
			expect(approve(bound, { ...login, domain }).refused).toBe('websiteMismatch');
	});

	test('nothing is released without a picked login or a required code', () => {
		expect(approve({}).refused).toBe('loginRequired');
		expect(approve({ requireServiceOtp: true }, login).refused).toBe('codeRequired');
		expect(approve({}, { ...login, twoFactorEveryTime: true }).refused).toBe('codeRequired');
	});

	test('the stored username and website cannot be swapped under the seal', () => {
		const output = execFileSync(binary, ['--stored-hints'], { input: '', encoding: 'utf8' });
		expect(JSON.parse(output)).toEqual({
			username: true,
			domain: true,
			untouched: true,
			otherUsername: false,
			otherDomain: false
		});
	});
});
