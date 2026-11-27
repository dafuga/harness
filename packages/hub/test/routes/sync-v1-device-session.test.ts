import type {
	SealedChainEntry,
	SealedGrant
} from '../../../remote/src/models/networking-security/Sealed.types';
import type { EnrollmentMailbox } from '../../../remote/src/services/networking-security/SealedEnrollmentReviewService.types';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { SealedEnrollmentReviewService } from '../../../remote/src/services/networking-security/SealedEnrollmentReviewService';
import { chainEntryHash } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import { sealedChain } from '../../../remote/src/utils/networking-security/sealedChain';
import { openSealedGrant } from '../../../remote/src/utils/networking-security/sealedGrant';
import { fromBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import {
	sealedSas,
	sealedEnrollCommit
} from '../../../remote/src/utils/networking-security/sealedSas';
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
	const inbox = await fixture.call(session, 'GET', 'enroll', { headers });
	expect(await snapshot(inbox)).toEqual({ status: 200, body: { requests: [] } });
	const listener = await fixture.socket(session, device.deviceId);
	listener.close();
	const pending = await sealedDevice();
	const unrelated = await fixture.call(otherSession, 'GET', 'device-session', {
		headers: { 'X-Harness-Device': pending.deviceId }
	});
	expect(await snapshot(unrelated)).toEqual({
		status: 200,
		body: { state: 'waiting-for-approval' }
	});
	const newHeaders = { 'X-Harness-Device': pending.deviceId };
	const heldInbox = await fixture.call(otherSession, 'GET', 'enroll', { headers: newHeaders });
	expect(await snapshot(heldInbox)).toEqual({
		status: 403,
		body: { error: 'device-approval-required' }
	});
	const requestNonce = crypto.getRandomValues(new Uint8Array(32));
	const opening = {
		kemPublic: toBase64Url(pending.kemPublic),
		signingPublic: toBase64Url(pending.signingPublic),
		commit: await sealedEnrollCommit(pending, requestNonce)
	};
	const mailbox = await fixture.call(otherSession, 'POST', 'enroll', {
		headers: newHeaders,
		body: opening
	});
	expect(mailbox.status).toBe(201);
	const { id } = (await mailbox.json()) as { id: string };
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
	const pathToMailbox = 'enroll/' + id;
	const claimed = (await (
		await fixture.call(otherSession, 'GET', pathToMailbox, { headers: newHeaders })
	).json()) as EnrollmentMailbox;
	const claim = JSON.parse(claimed.steps[1].body);
	const code = await sealedSas({
		request: pending,
		requestNonce,
		approverSigningPublic: device.signingPublic,
		approverNonce: fromBase64Url(claim.nonce)
	});
	expect(
		(
			await fixture.call(otherSession, 'POST', pathToMailbox, {
				headers: newHeaders,
				body: { nonce: toBase64Url(requestNonce) }
			})
		).status
	).toBe(201);
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
	const history = (await (
		await fixture.call(otherSession, 'GET', 'chain', { headers: newHeaders })
	).json()) as { entries: SealedChainEntry[] };
	const chain = await sealedChain(history.entries, { account, pin: nextPin! });
	const delivered = (await (
		await fixture.call(otherSession, 'GET', 'grants?device=' + pending.deviceId, {
			headers: newHeaders
		})
	).json()) as { grants: SealedGrant[] };
	expect(toBase64Url((await openSealedGrant(delivered.grants[0], pending, chain)).scopeId)).toBe(
		scope
	);
	expect(await (await fixture.call(session, 'GET', 'enroll', { headers })).json()).toEqual({
		requests: []
	});
}, 60_000);
