import { afterAll, beforeAll, expect, test } from 'vitest';
import { SealedEnrollmentReviewService } from '../../../remote/src/services/networking-security/SealedEnrollmentReviewService';
import { chainEntryHash } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import { SealedEnrollmentRequestService } from '../../../remote/src/services/networking-security/SealedEnrollmentRequestService';
import type { EnrollmentProgress } from '../../../remote/src/services/networking-security/SealedEnrollmentRequestService.types';
import { sealedDevice } from '../../../remote/src/utils/networking-security/sealedDevice';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { readSealedDeviceSession } from '../../../remote/src/utils/networking-security/readSealedDeviceSession';
import { bootstrapCandidate } from '../support/syncBootstrapCandidate';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

const account = 'google:fixture-a';
const session = 'session-a';
const otherSession = 'session-a-browser';
const pushPath = 'approval-push';
const pushKey =
	'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
let fixture: SyncFixture;
beforeAll(async () => {
	fixture = await startSync({ country: 'PT' });
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
	return {
		device: admin,
		headers,
		pin: { seq: 0, head: await chainEntryHash(body.entry) },
		scope: body.grants[0].scope
	};
}

test('an enrolled identifier cannot approve another Google session', async () => {
	const { device, headers, scope, pin } = await signedIn();
	const path = `ops/${scope}`;
	const projects = () =>
		fetch(fixture.origin + '/api/projects', { headers: { 'X-Test-Session': otherSession } });
	expect(await snapshot(await projects())).toEqual({
		status: 403,
		body: { error: 'device-approval-required' }
	});
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
	await verifyPushRegistration(device, headers);
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
	const inbox = await fixture.call(session, 'GET', 'enroll', { headers });
	expect(await snapshot(inbox)).toEqual({ status: 200, body: { requests: [] } });
	(await fixture.socket(session, device.deviceId)).close();
	const pending = await sealedDevice();
	const newHeaders = { 'X-Harness-Device': pending.deviceId };
	const heldInbox = await fixture.call(otherSession, 'GET', 'enroll', { headers: newHeaders });
	expect(await snapshot(heldInbox)).toEqual({
		status: 403,
		body: { error: 'device-approval-required' }
	});
	const requestNonce = crypto.getRandomValues(new Uint8Array(32));
	const browserRequest = (path: string, init: RequestInit) =>
		fetch(fixture.origin + path, {
			...init,
			headers: { ...init.headers, 'X-Test-Session': otherSession, 'CF-IPCountry': 'CA' }
		});
	const login = () =>
		new SealedEnrollmentRequestService({
			account,
			device: pending,
			signal: new AbortController().signal,
			request: browserRequest
		});
	let progress: EnrollmentProgress = { nonce: requestNonce };
	const save = async (next: EnrollmentProgress) => {
		progress = structuredClone(next);
	};
	expect(await login().resolve(progress, save)).toEqual({
		state: 'waiting-for-approval',
		code: null
	});
	const id = progress.mailbox!;
	expect(id).toMatch(/^[a-f0-9]{32}$/);
	expect(await login().resolve(progress, save)).toEqual({
		state: 'waiting-for-approval',
		code: null
	});
	expect(progress.mailbox).toBe(id);
	await verifyPushDelivery(1);
	const visible = await fixture.call(session, 'GET', 'enroll', { headers });
	expect(await visible.json()).toEqual({
		requests: [
			expect.objectContaining({
				id,
				createdAt: expect.any(Number),
				display: { platform: 'web', country: 'PT' }
			})
		]
	});
	await expect(fixture.socket(otherSession, pending.deviceId)).rejects.toThrow();
	let dropPublishedReply = true;
	const review = new SealedEnrollmentReviewService(
		{
			account,
			pin,
			device,
			signal: new AbortController().signal,
			request: async (path, init) => {
				const response = await fetch(fixture.origin + path, {
					...init,
					headers: { ...init.headers, 'X-Test-Session': session }
				});
				if (path.endsWith('/devices') && dropPublishedReply && response.status === 201) {
					dropPublishedReply = false;
					await response.body?.cancel();
					throw new Error('Fixture lost the enrollment reply.');
				}
				return response;
			}
		},
		id
	);
	await review.claim();
	expect(await review.comparison()).toBeNull();
	const waiting = await login().resolve(progress, save);
	expect(waiting).toEqual({
		state: 'waiting-for-approval',
		code: expect.stringMatching(/^\d{6}$/)
	});
	if (waiting.state !== 'waiting-for-approval' || !waiting.code) throw new Error('Missing code');
	const code = waiting.code;
	expect(progress.claim?.approver).toBe(device.deviceId);
	expect(await review.comparison()).toBe(code);
	expect(await review.approve(code, async () => false)).toBeNull();
	expect(
		await snapshot(
			await fixture.call(otherSession, 'GET', 'device-session', { headers: newHeaders })
		)
	).toEqual({ status: 200, body: { state: 'waiting-for-approval' } });
	await expect(review.approve(code, async () => true)).rejects.toThrow(
		'Fixture lost the enrollment reply.'
	);
	const nextPin = await review.approve(code, async () => {
		throw new Error('Retry prompted twice.');
	});
	expect(nextPin?.seq).toBe(1);
	const withoutGrants = new SealedEnrollmentRequestService({
		account,
		device: pending,
		signal: new AbortController().signal,
		request: (path, init) =>
			path.includes('/grants?')
				? Promise.resolve(Response.json({ grants: [] }))
				: browserRequest(path, init)
	});
	await expect(withoutGrants.resolve(progress, save)).rejects.toThrow(
		'A current grant is missing.'
	);
	expect((await fixture.call(otherSession, 'GET', path, { headers: newHeaders })).status).toBe(403);
	const admitted = await login().resolve(progress, save);
	expect(admitted.state).toBe('approved');
	if (admitted.state !== 'approved') throw new Error('Missing admission');
	expect(admitted.pin).toEqual(nextPin);
	expect(toBase64Url(admitted.keys[0].scopeId)).toBe(scope);
	expect(admitted.keys[0].dataKey.extractable).toBe(false);
	expect(await snapshot(await projects())).toEqual({ status: 200, body: [] });
	expect((await fixture.call(otherSession, 'GET', path, { headers: newHeaders })).status).toBe(200);
	expect(await (await fixture.call(session, 'GET', 'enroll', { headers })).json()).toEqual({
		requests: []
	});
	await verifySignedOutPushDelivery(browserRequest);
}, 60_000);

async function verifyPushRegistration(
	device: Awaited<ReturnType<typeof sealedDevice>>,
	headers: Record<string, string>
) {
	const body = {
		endpoint: 'https://fcm.googleapis.com/fcm/send/approval-fixture',
		keys: { p256dh: toBase64Url(device.kemPublic), auth: 'a'.repeat(22) }
	};
	expect(
		await snapshot(await fixture.call(otherSession, 'POST', pushPath, { headers, body }))
	).toEqual({
		status: 403,
		body: { error: 'device-approval-required' }
	});
	expect(
		await snapshot(
			await fixture.call(session, 'POST', pushPath, {
				headers: { ...headers, Origin: 'https://unrelated.example' },
				body
			})
		)
	).toEqual({ status: 403, body: { error: 'origin-denied' } });
	expect(await snapshot(await fixture.call(session, 'GET', pushPath, { headers }))).toEqual({
		status: 200,
		body: { publicKey: pushKey }
	});
	expect(await snapshot(await fixture.call(session, 'POST', pushPath, { headers, body }))).toEqual({
		status: 200,
		body: { subscribed: true }
	});
}

async function verifySignedOutPushDelivery(
	request: (path: string, init: RequestInit) => Promise<Response>
) {
	await fixture.db
		.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE id_hash = ?')
		.bind(Date.now(), 'test-' + session)
		.run();
	const device = await sealedDevice();
	const flow = new SealedEnrollmentRequestService({
		account,
		device,
		signal: new AbortController().signal,
		request
	});
	const nonce = crypto.getRandomValues(new Uint8Array(32));
	expect(await flow.resolve({ nonce }, async () => {})).toEqual({
		state: 'waiting-for-approval',
		code: null
	});
	await verifyPushDelivery(1);
}

async function verifyPushDelivery(count: number) {
	const rows = await fixture.db
		.prepare('SELECT kind FROM fixture_approval_deliveries ORDER BY rowid')
		.all<{ kind: string }>();
	expect(rows.results).toEqual(Array.from({ length: count }, () => ({ kind: 'device-approval' })));
}
