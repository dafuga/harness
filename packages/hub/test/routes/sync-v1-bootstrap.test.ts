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
	sealedGrant
} from '../../../remote/src/utils/networking-security/sealedGrant';
import {
	newRecoverySecret,
	openSealedRecovery,
	sealedRecovery
} from '../../../remote/src/utils/networking-security/sealedRecovery';
import {
	newScopeKeys,
	scopeCommitment
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

const account = 'google:fixture-a';
let fixture: SyncFixture;
beforeAll(async () => {
	fixture = await startSync({ migrations: ['0010-sealed-recoveries'] });
}, 120_000);
afterAll(async () => {
	await fixture?.stop();
});

async function candidate() {
	const [admin, backup] = await Promise.all([sealedDevice(), sealedDevice({ extractable: true })]);
	const key = newScopeKeys();
	const secret = newRecoverySecret();
	const scope = toBase64Url(key.scopeId);
	const commitment = toBase64Url(await scopeCommitment(key));
	const devices = [
		sealedDevicePublic(admin, 'admin', [scope]),
		sealedDevicePublic(backup, 'recovery', [scope])
	];
	const entry = await sealedChainEntry(admin, {
		seq: 0,
		prev: '',
		at: 1,
		by: admin.deviceId,
		body: { type: 'genesis', account, devices, scopes: [{ scope, epoch: 0, commitment }] }
	});
	const grants = await Promise.all(devices.map((device) => sealedGrant(account, key, device)));
	const recovery = await sealedRecovery(secret, backup);
	const headers = { 'X-Harness-Device': admin.deviceId };
	return { body: { entry, grants, recovery }, headers, secret, commitment };
}

async function snapshot(response: Response) {
	return { status: response.status, body: (await response.json()) as unknown };
}

test('first sign-ins compete for one atomic and recoverable account bootstrap', async () => {
	const [first, second] = await Promise.all([candidate(), candidate()]);
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
	await verifyRecovery(winner);
}, 60_000);

async function verifyRecovery(winner: Awaited<ReturnType<typeof candidate>>) {
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
}
