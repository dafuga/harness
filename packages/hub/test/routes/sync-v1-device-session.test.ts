import { afterAll, beforeAll, expect, test } from 'vitest';
import { sealedDevice } from '../../../remote/src/utils/networking-security/sealedDevice';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { readSealedDeviceSession } from '../../../remote/src/utils/networking-security/readSealedDeviceSession';
import { bootstrapCandidate } from '../support/syncBootstrapCandidate';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

const account = 'google:fixture-a';
const session = 'session-a';
const otherSession = 'session-a-browser';
let fixture: SyncFixture;
beforeAll(async () => {
	fixture = await startSync();
	await fixture.db.batch(
		[session, otherSession].map((token) =>
			fixture.db
				.prepare(
					`INSERT INTO auth_sessions (id_hash, kind, actor_id, actor_email, actor_name, resource, created_at, expires_at)
		 VALUES (?, 'native', ?, 'test@example.test', 'Test', 'projects', 1, ?)`
				)
				.bind('test-' + token, account, Date.now() + 120_000)
		)
	);
}, 120_000);
afterAll(async () => {
	await fixture?.stop();
});

async function snapshot(response: Response) {
	return { status: response.status, body: (await response.json()) as unknown };
}

async function signedIn() {
	const candidate = await bootstrapCandidate(account);
	const { headers, admin, body } = candidate;
	const first = await fixture.call(session, 'GET', 'device-session', { headers });
	expect(await snapshot(first)).toEqual({ status: 200, body: { state: 'first-device' } });
	const response = await fixture.call(session, 'POST', 'bootstrap', candidate);
	expect(response.status).toBe(201);
	return { device: admin, headers, scope: body.grants[0].scope };
}

test('an enrolled identifier cannot approve another Google session', async () => {
	const { device, headers, scope } = await signedIn();
	const path = `ops/${scope}`;
	const hold = await fixture.call(session, 'GET', path, { headers });
	expect(await snapshot(hold)).toEqual({
		status: 403,
		body: { error: 'device-approval-required' }
	});
	const start = await fixture.call(session, 'GET', 'device-session', { headers });
	expect(start.status).toBe(200);
	const challenge = (await start.json()) as { state: string; challenge: string };
	expect(challenge).toEqual({
		state: 'proof-required',
		challenge: expect.stringMatching(/^[\w-]{43}$/)
	});
	const bytes = new TextEncoder().encode('harness/sealed/v1/session\0' + challenge.challenge);
	const sig = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		device.signing.privateKey,
		bytes
	);
	const body = { challenge: challenge.challenge, signature: toBase64Url(new Uint8Array(sig)) };
	const copied = await fixture.call(otherSession, 'POST', 'device-session', { headers, body });
	expect(await snapshot(copied)).toEqual({ status: 403, body: { error: 'device-proof-denied' } });
	const approved = await readSealedDeviceSession(
		(path, init) =>
			fetch(fixture.origin + path, {
				...init,
				headers: { ...init.headers, 'X-Test-Session': session }
			}),
		device
	);
	expect(approved).toBe('approved');
	const held = await fixture.call(session, 'GET', 'device-session', { headers });
	expect(await snapshot(held)).toEqual({ status: 200, body: { state: 'approved' } });
	expect((await fixture.call(session, 'GET', path, { headers })).status).toBe(200);
	const wrongScope = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
	const forbidden = await fixture.call(session, 'GET', `objects/${wrongScope}`, { headers });
	expect(await snapshot(forbidden)).toEqual({ status: 403, body: { error: 'scope-denied' } });
	const bypass = await fixture.call(otherSession, 'GET', path, { headers });
	expect(await snapshot(bypass)).toEqual({
		status: 403,
		body: { error: 'device-approval-required' }
	});
	const pending = await sealedDevice();
	const unrelated = await fixture.call(otherSession, 'GET', 'device-session', {
		headers: { 'X-Harness-Device': pending.deviceId }
	});
	expect(await snapshot(unrelated)).toEqual({
		status: 200,
		body: { state: 'waiting-for-approval' }
	});
}, 60_000);
