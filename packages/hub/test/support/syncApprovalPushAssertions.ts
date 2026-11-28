import { expect } from 'vitest';
import { chainEntryHash } from '../../../remote/src/utils/networking-security/sealedChainEntry';
import { bootstrapCandidate } from './syncBootstrapCandidate';
import { SealedEnrollmentRequestService } from '../../../remote/src/services/networking-security/SealedEnrollmentRequestService';
import type { SealedDeviceKeys } from '../../../remote/src/models/networking-security/Sealed.types';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { sealedDevice } from '../../../remote/src/utils/networking-security/sealedDevice';
import type { SyncFixture } from './syncFixture.types';

const pushPath = 'approval-push';
const pushKey =
	'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';

export async function snapshot(response: Response) {
	return { status: response.status, body: (await response.json()) as unknown };
}

export async function verifyPushRegistration(
	fixture: SyncFixture,
	{ session, otherSession }: { session: string; otherSession: string },
	device: SealedDeviceKeys,
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

export async function verifySignedOutPushDelivery(
	fixture: SyncFixture,
	{ account, session }: { account: string; session: string },
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
	await verifyPushDelivery(fixture, 1);
}

export async function verifyPushDelivery(fixture: SyncFixture, count: number) {
	const rows = await fixture.db
		.prepare('SELECT kind FROM fixture_approval_deliveries ORDER BY rowid')
		.all<{ kind: string }>();
	expect(rows.results).toEqual(Array.from({ length: count }, () => ({ kind: 'device-approval' })));
}

export async function signedIn(fixture: SyncFixture, account: string, session: string) {
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
