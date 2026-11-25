import { expect, test } from 'vitest';
import type {
	SealedChainBody,
	SealedChainEntry,
	SealedDeviceKeys
} from '../../../remote/src/models/networking-security/Sealed.types';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedGrant } from '../../../remote/src/utils/networking-security/sealedGrant';
import {
	newScopeKeys,
	scopeCommitment
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

import type { RotationFixture } from './sync-v1-devices.test.types';

const session = 'session-enroll';
const account = 'google:fixture-enroll';

const answer = async (response: Response) => {
	const body = (await response.json()) as { error?: string };
	return `${response.status} ${body.error ?? 'ok'}`;
};

test('device changes commit their signed entries and exact grants together', async () => {
	const f = await startSync();
	try {
		await checkDeviceChanges(f);
	} finally {
		await f.stop();
	}
}, 60_000);

async function checkDeviceChanges(f: SyncFixture) {
	const admin = await sealedDevice(),
		phone = await sealedDevice();
	const headers = { 'X-Harness-Device': admin.deviceId };
	const keys = newScopeKeys(),
		scope = toBase64Url(keys.scopeId);
	const recipient = sealedDevicePublic(phone, 'admin', [scope]);
	const root = await sign(admin, null, {
		type: 'genesis',
		account,
		devices: [sealedDevicePublic(admin, 'admin', [scope])],
		scopes: [{ scope, epoch: 0, commitment: toBase64Url(await scopeCommitment(keys)) }]
	});
	const post = (path: string, body: unknown) => f.call(session, 'POST', path, { body, headers });
	const read = async () =>
		(await (await f.call(session, 'GET', 'chain', { headers })).json()) as {
			entries: SealedChainEntry[];
		};
	expect(await answer(await post('chain', root))).toBe('201 ok');
	const enroll = await sign(admin, root, { type: 'enroll', device: recipient });
	const grant = await sealedGrant(account, keys, recipient);
	expect(await answer(await post('devices', { entries: [enroll], grants: [] }))).toBe(
		'400 invalid-change'
	);
	expect((await read()).entries).toEqual([root]);
	const batch = { entries: [enroll], grants: [grant] };
	expect(await answer(await post('grants', grant))).toBe('201 ok');
	expect(await answer(await post('devices', batch))).toBe('409 chain-conflict');
	expect((await read()).entries).toEqual([root]);
	await f.db.prepare('DELETE FROM sealed_grants WHERE account = ?').bind(account).run();
	expect(await answer(await post('devices', batch))).toBe('201 ok');
	expect(await answer(await post('devices', batch))).toBe('200 ok');
	await checkRotation(f, headers, { admin, phone, keys, root, enroll });
}

async function checkRotation(
	f: SyncFixture,
	headers: Record<string, string>,
	input: RotationFixture
) {
	const { admin, phone, keys, root, enroll } = input;
	const headersAndBody = (body: unknown) => ({ headers, body });
	const post = (_path: string, body: unknown) =>
		f.call(session, 'POST', 'devices', headersAndBody(body));
	const read = async () =>
		(await (await f.call(session, 'GET', 'chain', { headers })).json()) as {
			entries: SealedChainEntry[];
		};
	const scope = toBase64Url(keys.scopeId);
	const recipient = sealedDevicePublic(phone, 'admin', [scope]);
	const revoke = await sign(admin, enroll, { type: 'revoke', device: phone.deviceId });
	const fresh = newScopeKeys(keys);
	const rotate = await sign(admin, revoke, {
		type: 'rotate',
		commitment: {
			scope,
			epoch: 1,
			commitment: toBase64Url(await scopeCommitment(fresh))
		}
	});
	const newGrant = await sealedGrant(account, fresh, sealedDevicePublic(admin, 'admin', [scope]));
	expect(
		await answer(
			await post('devices', {
				entries: [revoke, rotate],
				grants: [newGrant, await sealedGrant(account, fresh, recipient)]
			})
		)
	).toBe('400 invalid-change');
	expect((await read()).entries).toEqual([root, enroll]);
	expect(
		await answer(await post('devices', { entries: [revoke, rotate], grants: [newGrant] }))
	).toBe('201 ok');
	expect((await read()).entries).toEqual([root, enroll, revoke, rotate]);
}

async function sign(admin: SealedDeviceKeys, last: SealedChainEntry | null, body: SealedChainBody) {
	const seq = last ? last.seq + 1 : 0;
	return sealedChainEntry(admin, {
		seq,
		at: seq + 1,
		prev: last ? await chainEntryHash(last) : '',
		by: admin.deviceId,
		body
	});
}
