import { afterAll, beforeAll, expect, test } from 'vitest';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { sealedChain } from '../../../remote/src/utils/networking-security/sealedChain';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import {
	openSealedGrant,
	rewrapSealedGrant,
	sealedGrant
} from '../../../remote/src/utils/networking-security/sealedGrant';
import { openSealedRecovery } from '../../../remote/src/utils/networking-security/sealedRecovery';
import { bootstrapCandidate } from '../support/syncBootstrapCandidate';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

const account = 'google:fixture-a';
let fixture: SyncFixture;
beforeAll(async () => {
	fixture = await startSync();
}, 120_000);
afterAll(async () => {
	await fixture?.stop();
});

async function snapshot(response: Response) {
	return { status: response.status, body: (await response.json()) as unknown };
}

test('first sign-ins compete for one atomic and recoverable account bootstrap', async () => {
	const [first, second] = await Promise.all([
		bootstrapCandidate(account),
		bootstrapCandidate(account)
	]);
	const invalid = { ...first.body, grants: first.body.grants.slice(0, 1) };
	const malformed = await fixture.call('session-a', 'POST', 'bootstrap', {
		body: invalid,
		headers: first.headers
	});
	expect(await snapshot(malformed)).toEqual({ status: 400, body: { error: 'invalid-bootstrap' } });
	const [a, b] = await Promise.all(
		[first, second].map((request) => fixture.call('session-a', 'POST', 'bootstrap', request))
	);
	const [winner, loser] = a.status === 201 ? [first, b] : [second, a];
	const rejected = winner === first ? second : first;
	const expected = { seq: 0, hash: await chainEntryHash(winner.body.entry) };
	expect(await snapshot(a.status === 201 ? a : b)).toEqual({ status: 201, body: expected });
	expect(await snapshot(loser)).toEqual({ status: 409, body: { error: 'chain-conflict' } });
	const grantPath = `grants?device=${rejected.headers['X-Harness-Device']}`;
	expect(
		await snapshot(await fixture.call('session-a', 'GET', grantPath, { headers: rejected.headers }))
	).toEqual({
		status: 200,
		body: { grants: [] }
	});
	expect(await snapshot(await fixture.call('session-a', 'POST', 'bootstrap', winner))).toEqual({
		status: 200,
		body: expected
	});
	await verifyWriters(winner, rejected, expected.hash);
	await verifyRecovery(winner);
}, 60_000);

async function verifyWriters(
	winner: Awaited<ReturnType<typeof bootstrapCandidate>>,
	rejected: Awaited<ReturnType<typeof bootstrapCandidate>>,
	prev: string
) {
	const admin = winner.admin;
	const signingDevice = rejected.body.entry.body;
	if (signingDevice.type !== 'genesis') throw new Error('Expected a genesis fixture');
	const scope = winner.body.grants[0].scope;
	const device = { ...signingDevice.devices[0], scopes: [scope] };
	const entry = await sealedChainEntry(admin, {
		seq: 1,
		prev,
		at: 2,
		by: admin.deviceId,
		body: { type: 'enroll', device }
	});
	const grant = await sealedGrant(account, winner.key, device);
	const headers = winner.headers;
	const expected = { status: 409, body: { error: 'atomic-device-change-required' } };
	expect(
		await snapshot(await fixture.call('session-a', 'POST', 'chain', { headers, body: entry }))
	).toEqual(expected);
	expect(
		await snapshot(await fixture.call('session-a', 'POST', 'grants', { headers, body: grant }))
	).toEqual(expected);
	const body = { entries: [entry], grants: [grant] };
	const invalid = { entries: body.entries, grants: [] };
	expect(
		await snapshot(await fixture.call('session-a', 'POST', 'devices', { headers, body: invalid }))
	).toEqual({
		status: 400,
		body: { error: 'invalid-change' }
	});
	const saved = { seq: 1, hash: await chainEntryHash(entry) };
	expect(
		await snapshot(await fixture.call('session-a', 'POST', 'devices', { headers, body }))
	).toEqual({ status: 201, body: saved });
	expect(
		await snapshot(await fixture.call('session-a', 'POST', 'devices', { headers, body }))
	).toEqual({ status: 200, body: saved });
}

async function verifyRecovery(winner: Awaited<ReturnType<typeof bootstrapCandidate>>) {
	for (const [session, status, error] of [
		[null, 401, 'session-required'],
		['session-b', 404, 'not-found']
	] as const) {
		const denied = await fixture.call(session, 'GET', 'bootstrap', { headers: winner.headers });
		expect(await snapshot(denied)).toEqual({ status, body: { error } });
	}
	const request = { headers: winner.headers };
	const response = await fixture.call('session-a', 'GET', 'bootstrap', request);
	const { recovery } = (await response.json()) as { recovery: string };
	expect(response.status).toBe(200);
	const freshDevice = await openSealedRecovery(winner.secret, recovery);
	const chain = await fixture.call('session-a', 'GET', 'chain', request);
	const history = (await chain.json()) as { entries: Array<typeof winner.body.entry> };
	const verified = await sealedChain(history.entries, { account });
	expect(verified.devices[freshDevice.deviceId].role).toBe('recovery');
	const grants = await fixture.call(
		'session-a',
		'GET',
		`grants?device=${freshDevice.deviceId}`,
		request
	);
	const stored = (await grants.json()) as { grants: typeof winner.body.grants };
	expect(stored.grants).toEqual([winner.body.grants[1]]);
	const keys = await openSealedGrant(stored.grants[0], freshDevice, verified);
	expect(toBase64Url(keys.commitment)).toBe(winner.commitment);
	await recoverInstallation(stored.grants[0], freshDevice, verified);
}

async function recoverInstallation(
	grant: Parameters<typeof openSealedGrant>[0],
	recovery: Parameters<typeof openSealedGrant>[1],
	chain: Parameters<typeof openSealedGrant>[2]
) {
	const replacement = await sealedDevice();
	const device = sealedDevicePublic(replacement, 'admin', [grant.scope]);
	const entry = await sealedChainEntry(recovery, {
		seq: chain.seq + 1,
		prev: chain.head,
		at: 3,
		by: recovery.deviceId,
		body: { type: 'enroll', device }
	});
	expect(rewrapSealedGrant).toBeTypeOf('function');
	const wrapped = await rewrapSealedGrant(grant, recovery, chain, device);
	const headers = { 'X-Harness-Device': recovery.deviceId };
	const response = await fixture.call('session-a', 'POST', 'devices', {
		headers,
		body: { entries: [entry], grants: [wrapped] }
	});
	expect(await snapshot(response)).toEqual({
		status: 201,
		body: { seq: entry.seq, hash: await chainEntryHash(entry) }
	});
	await readReplacementGrant(grant, replacement, headers);
}

async function readReplacementGrant(
	original: Parameters<typeof openSealedGrant>[0],
	replacement: Parameters<typeof openSealedGrant>[1],
	headers: { 'X-Harness-Device': string }
) {
	const path = `grants?device=${replacement.deviceId}`;
	const reply = await fixture.call('session-a', 'GET', path, { headers });
	const { grants } = (await reply.json()) as { grants: (typeof original)[] };
	expect(grants).toHaveLength(1);
	const history = await fixture.call('session-a', 'GET', 'chain', { headers });
	const { entries } = (await history.json()) as {
		entries: Awaited<ReturnType<typeof sealedChainEntry>>[];
	};
	const state = await sealedChain(entries, { account });
	const opened = await openSealedGrant(grants[0], replacement, state);
	expect(toBase64Url(opened.commitment)).toBe(state.scopes[original.scope].commitments[0]);
}
