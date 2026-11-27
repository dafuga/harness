import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedChainEntry } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
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
	const device = await sealedDevice();
	const headers = { 'X-Harness-Device': device.deviceId };
	const entry = await sealedChainEntry(device, {
		seq: 0,
		prev: '',
		at: 1,
		by: device.deviceId,
		body: {
			type: 'genesis',
			account,
			scopes: [],
			devices: [sealedDevicePublic(device, 'admin', [])]
		}
	});
	const response = await fixture.call(session, 'POST', 'chain', { headers, body: entry });
	expect(response.status).toBe(201);
	return { device, headers };
}

test('an enrolled identifier cannot approve another Google session', async () => {
	const { device, headers } = await signedIn();
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
	const approved = await fixture.call(session, 'POST', 'device-session', { headers, body });
	expect(await snapshot(approved)).toEqual({ status: 200, body: { state: 'approved' } });
	const held = await fixture.call(session, 'GET', 'device-session', { headers });
	expect(await snapshot(held)).toEqual({ status: 200, body: { state: 'approved' } });
	const pending = await sealedDevice();
	const unrelated = await fixture.call(otherSession, 'GET', 'device-session', {
		headers: { 'X-Harness-Device': pending.deviceId }
	});
	expect(await snapshot(unrelated)).toEqual({
		status: 200,
		body: { state: 'waiting-for-approval' }
	});
}, 60_000);
