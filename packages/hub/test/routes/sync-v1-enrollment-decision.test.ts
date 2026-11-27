import { afterAll, beforeAll, expect, test } from 'vitest';
import { readSealedDeviceSession } from '../../../remote/src/utils/networking-security/readSealedDeviceSession';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedGrant } from '../../../remote/src/utils/networking-security/sealedGrant';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { sealedEnrollCommit } from '../../../remote/src/utils/networking-security/sealedSas';
import { bootstrapCandidate } from '../support/syncBootstrapCandidate';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

const account = 'google:fixture-a';
const approver = 'session-a';
const requester = 'session-a-browser';
let fixture: SyncFixture;

beforeAll(async () => {
	fixture = await startSync();
	await fixture.db
		.prepare(
			`INSERT INTO auth_sessions
			(id_hash, kind, actor_id, actor_email, actor_name, resource, created_at, expires_at)
			VALUES (?, 'native', ?, 'test@example.test', 'Test', 'projects', 1, ?)`
		)
		.bind('test-' + approver, account, Date.now() + 120_000)
		.run();
}, 120_000);
afterAll(async () => {
	await fixture?.stop();
});

test('an approved device can deny a request and prevent its concurrent publication', async () => {
	const candidate = await bootstrapCandidate(account);
	const { admin, headers } = candidate;
	expect((await fixture.call(approver, 'POST', 'bootstrap', candidate)).status).toBe(201);
	expect(
		await readSealedDeviceSession(
			(path, init) =>
				fetch(fixture.origin + path, {
					...init,
					headers: { ...init.headers, 'X-Test-Session': approver }
				}),
			admin
		)
	).toBe('approved');
	const blocked = await requestEnrollment(candidate);
	const denial = { body: { deny: true }, headers };
	expect(
		(await fixture.call(requester, 'POST', blocked.path, { ...denial, headers: blocked.headers }))
			.status
	).toBe(403);
	expect((await fixture.call(approver, 'POST', blocked.path, denial)).status).toBe(201);
	expect((await fixture.call(approver, 'POST', blocked.path, denial)).status).toBe(200);
	expect((await fixture.call(approver, 'POST', 'devices', blocked.publication)).status).toBe(409);
	await expect(
		(await fixture.call(requester, 'GET', blocked.path, { headers: blocked.headers })).json()
	).resolves.toMatchObject({ denied: true });
	await expect(
		(await fixture.call(approver, 'GET', 'enroll', { headers })).json()
	).resolves.toEqual({
		requests: []
	});

	const competing = await requestEnrollment(candidate);
	const [published, denied] = await Promise.all([
		fixture.call(approver, 'POST', 'devices', competing.publication),
		fixture.call(approver, 'POST', competing.path, denial)
	]);
	expect([published.status, denied.status].sort()).toEqual([201, 409]);
	const [entry] = competing.publication.body.entries;
	const { entries } = (await (
		await fixture.call(approver, 'GET', 'chain', { headers })
	).json()) as {
		entries: unknown[];
	};
	expect(entries.slice(1)).toEqual(published.status === 201 ? [entry] : []);
}, 60_000);

async function requestEnrollment(candidate: Awaited<ReturnType<typeof bootstrapCandidate>>) {
	const { admin, key } = candidate;
	const pending = await sealedDevice();
	const headers = { 'X-Harness-Device': pending.deviceId };
	const nonce = crypto.getRandomValues(new Uint8Array(32));
	const body = {
		kemPublic: toBase64Url(pending.kemPublic),
		signingPublic: toBase64Url(pending.signingPublic),
		commit: await sealedEnrollCommit(pending, nonce)
	};
	const opened = await fixture.call(requester, 'POST', 'enroll', { headers, body });
	expect(opened.status).toBe(201);
	const { id } = (await opened.json()) as { id: string };
	const path = 'enroll/' + id;
	const claimed = await fixture.call(approver, 'POST', path, {
		headers: candidate.headers,
		body: {
			approver: admin.deviceId,
			nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
		}
	});
	expect(claimed.status).toBe(201);
	const other = 'session-a-secondary';
	expect((await fixture.call(other, 'GET', path, { headers })).status).toBe(404);
	const nonceFields = { nonce: toBase64Url(nonce) };
	expect((await fixture.call(other, 'POST', path, { headers, body: nonceFields })).status).toBe(
		409
	);
	expect(
		(await fixture.call(requester, 'POST', path, { headers, body: { nonce: toBase64Url(nonce) } }))
			.status
	).toBe(201);
	const device = sealedDevicePublic(pending, 'admin', [toBase64Url(key.scopeId)]);
	const entry = await sealedChainEntry(admin, {
		seq: 1,
		prev: await chainEntryHash(candidate.body.entry),
		at: 2,
		by: admin.deviceId,
		body: { type: 'enroll', device }
	});
	return {
		path,
		headers,
		publication: {
			headers: candidate.headers,
			body: { entries: [entry], grants: [await sealedGrant(account, key, device)], enrollment: id }
		}
	};
}
