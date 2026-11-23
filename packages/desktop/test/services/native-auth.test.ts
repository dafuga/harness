import { test, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { NativeAuthService } from '../../src/lib/development-tooling/desktop-initialization/NativeAuthService';
import { HostedHttpAdapter } from '../../src/adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type { NativeSessionAdapter } from '../../src/adapters/networking-security/NativeSessionAdapter';
const origin = 'https://harness.example.invalid';
const browserCode = 'c'.repeat(43);

function nativeReceipt(nonce: string) {
	return {
		authorization: 'private-fixture-token',
		actor: {
			id: 'google:fixture',
			name: 'Fixture',
			email: 'fixture@example.invalid',
			emailVerified: true
		},
		audience: 'harness-desktop',
		resource: 'projects',
		nonce,
		expiresAt: new Date(Date.now() + 300000).toISOString()
	};
}

function setup(wrongNonce = false) {
	let challenge = '',
		nonce = '',
		now = Date.now(),
		port = 0;
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
			port = body.callback ?? 0;
			return Response.json({
				handoffId: 'fixture-id',
				userCode: port ? '' : 'FIXTURE',
				verificationUrl: origin + '/native/fixture-id' + (port ? '?return=1' : ''),
				expiresAt: new Date(Date.now() + 300000).toISOString(),
				interval: 1
			});
		}
		if (String(url).endsWith('/poll')) {
			expect(port).toBe(0);
			return Response.json({ status: 'approved' });
		}
		if (port) expect(body.callbackCode).toBe(browserCode);
		expect(createHash('sha256').update(body.verifier).digest('base64url')).toBe(challenge);
		return Response.json(nativeReceipt(wrongNonce ? 'wrong' : nonce));
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
		returnFromBrowser: () =>
			fetch(`http://127.0.0.1:${port}/harness-account?state=fixture-id&code=${browserCode}`),
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
test('Google sign-in uses a system browser loopback callback before it exchanges PKCE', async () => {
	const fixture = setup();
	const started = await fixture.service.connect(true);
	expect(started.handoff?.userCode).toBe('');
	expect(fixture.open).toHaveBeenCalledWith(origin + '/native/fixture-id?return=1');
	fixture.advance();
	expect((await fixture.service.status()).state).toBe('pending');
	expect(fixture.service.admitted).toBe(false);
	const result = await fixture.returnFromBrowser();
	expect(new URL(result.url).search).toBe('');
	fixture.advance();
	expect((await fixture.service.status()).state).toBe('signed-in');
	expect(fixture.service.admitted).toBe(true);
	expect(fixture.save).toHaveBeenCalledOnce();
});

test('a wrong native nonce never persists a credential', async () => {
	const f = setup(true);
	await f.service.connect();
	f.advance();
	await expect(f.service.status()).rejects.toThrow('handoff');
	expect(f.save).not.toHaveBeenCalled();
});

test.each([401, 403, 200])(
	'revoked or mismatched native status %s drops the session and protected cache',
	async (status) => {
		const credential = {
			origin,
			principalId: 'google:original',
			token: 'synthetic-private-native-token'
		};
		const store = {
			available: () => true,
			read: async () => credential,
			save: vi.fn(),
			clear: vi.fn()
		};
		const clearCache = vi.fn(async () => {}),
			onDisconnect = vi.fn();
		const http = new HostedHttpAdapter({
			origin,
			credentials: async () => credential,
			fetch: vi.fn(async () =>
				Response.json(
					{
						actor: {
							id: 'google:other',
							email: 'other@example.invalid',
							name: 'Other',
							emailVerified: true
						}
					},
					{ status }
				)
			) as unknown as typeof fetch
		});
		const service = new NativeAuthService({
			origin,
			http,
			store: store as unknown as NativeSessionAdapter,
			open: vi.fn(),
			clearCache,
			onDisconnect
		});
		await expect(service.status(), 'revoked identity returns to Google sign-in').resolves.toEqual({
			configured: true,
			state: 'signed-out'
		});
		expect(onDisconnect).toHaveBeenCalledOnce();
		expect(store.clear).toHaveBeenCalledOnce();
		expect(clearCache).toHaveBeenCalledOnce();
	}
);

test('a temporary native status failure preserves the encrypted login', async () => {
	const credential = {
		origin,
		principalId: 'google:original',
		token: 'synthetic-private-native-token'
	};
	const store = {
		available: () => true,
		read: async () => credential,
		save: vi.fn(),
		clear: vi.fn()
	};
	const http = new HostedHttpAdapter({
		origin,
		credentials: async () => credential,
		fetch: vi.fn(async () =>
			Response.json({ error: 'unavailable' }, { status: 503 })
		) as unknown as typeof fetch
	});
	const service = new NativeAuthService({
		origin,
		http,
		store: store as unknown as NativeSessionAdapter,
		open: vi.fn()
	});
	await expect(service.status()).rejects.toThrow();
	expect(store.clear).not.toHaveBeenCalled();
});

test('a stored session for another Hub is cleared without contacting the current Hub', async () => {
	const credential = {
		origin: 'https://other-hub.example.invalid',
		principalId: 'google:fixture',
		token: 'synthetic-other-hub-token'
	};
	const request = vi.fn(async () =>
		Response.json({ actor: { id: credential.principalId, emailVerified: true } })
	);
	const store = { read: vi.fn(async () => credential), clear: vi.fn(async () => {}) };
	const http = new HostedHttpAdapter({
		origin,
		credentials: store.read,
		fetch: request as unknown as typeof fetch
	});
	const service = new NativeAuthService({
		origin,
		http,
		store: store as unknown as NativeSessionAdapter,
		open: vi.fn()
	});
	expect(await service.status()).toEqual({ configured: true, state: 'signed-out' });
	expect(request).not.toHaveBeenCalled();
	expect(store.clear).toHaveBeenCalledOnce();
});
