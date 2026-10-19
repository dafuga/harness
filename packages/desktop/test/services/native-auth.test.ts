import { test, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { NativeAuthService } from '../../src/services/NativeAuthService';
import { HostedHttpAdapter } from '../../src/adapters/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../src/adapters/NativeSessionAdapter';
const origin = 'https://harness.example.invalid';
function setup(wrongNonce = false) {
	let challenge = '',
		nonce = '',
		now = Date.now();
	const save = vi.fn(),
		open = vi.fn();
	const store = {
		available: () => true,
		read: async () => null,
		save,
		clear: vi.fn()
	} as unknown as NativeSessionAdapter;
	const transport = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body));
		if (String(url).endsWith('/start')) {
			challenge = body.challenge;
			nonce = body.nonce;
			return Response.json({
				handoffId: 'fixture-id',
				userCode: 'FIXTURE',
				verificationUrl: origin + '/native/fixture-id',
				expiresAt: new Date(Date.now() + 300000).toISOString(),
				interval: 1
			});
		}
		if (String(url).endsWith('/poll')) return Response.json({ status: 'approved' });
		expect(createHash('sha256').update(body.verifier).digest('base64url')).toBe(challenge);
		return Response.json({
			authorization: 'private-fixture-token',
			actor: {
				id: 'google:fixture',
				name: 'Fixture',
				email: 'fixture@example.invalid',
				emailVerified: true
			},
			audience: 'harness-desktop',
			resource: 'projects',
			nonce: wrongNonce ? 'wrong' : nonce,
			expiresAt: new Date(Date.now() + 300000).toISOString()
		});
	});
	const http = new HostedHttpAdapter({
		origin,
		credentials: async () => null,
		fetch: transport as unknown as typeof fetch
	});
	return {
		service: new NativeAuthService({ origin, http, store, open, now: () => now }),
		save,
		open,
		advance: () => {
			now += 1000;
		}
	};
}
test('native PKCE exchanges only approved exact nonce/resource and keeps verifier and bearer outside renderer status', async () => {
	const f = setup();
	const started = await f.service.connect();
	expect(started.state).toBe('pending');
	expect(f.open).toHaveBeenCalledWith(origin + '/native/fixture-id');
	expect(JSON.stringify(started)).not.toContain('verifier');
	f.advance();
	const signedIn = await f.service.status();
	expect(signedIn.state).toBe('signed-in');
	expect(f.save).toHaveBeenCalledWith({
		origin,
		principalId: 'google:fixture',
		token: 'private-fixture-token'
	});
	expect(JSON.stringify(signedIn)).not.toContain('private-fixture-token');
});
test('a wrong native nonce never persists a credential', async () => {
	const f = setup(true);
	await f.service.connect();
	f.advance();
	await expect(f.service.status()).rejects.toThrow('handoff');
	expect(f.save).not.toHaveBeenCalled();
});
