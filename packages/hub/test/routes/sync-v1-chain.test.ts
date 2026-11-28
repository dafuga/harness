import { afterAll, beforeAll, expect, test } from 'vitest';
import type { SealedChainEntry } from '../../../remote/src/models/networking-security/Sealed.types';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../../remote/src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../remote/src/utils/networking-security/sealedDevice';
import { sealedGrant } from '../../../remote/src/utils/networking-security/sealedGrant';
import { newScopeKeys } from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

/** The chain and grant endpoints in workerd with a real D1 database. */
let f: SyncFixture;
beforeAll(async () => {
	f = await startSync();
}, 120_000);
afterAll(async () => {
	await f?.stop();
});

const A = 'session-a',
	B = 'session-b';
const answer = async (response: Response) => {
	const body = (await response.json()) as { error?: string };
	return `${response.status} ${body.error ?? 'ok'}`;
};

async function genesis(account = 'google:fixture-a') {
	const device = await sealedDevice();
	const body = {
		type: 'genesis' as const,
		account,
		devices: [sealedDevicePublic(device, 'admin', [])],
		scopes: []
	};
	const entry = await sealedChainEntry(device, {
		seq: 0,
		prev: '',
		at: 1,
		by: device.deviceId,
		body
	});
	return { device, entry };
}

async function next(
	device: Awaited<ReturnType<typeof sealedDevice>>,
	last: SealedChainEntry,
	seq = last.seq + 1
) {
	const body = {
		type: 'enroll' as const,
		device: sealedDevicePublic(await sealedDevice(), 'admin', [])
	};
	return sealedChainEntry(device, {
		seq,
		prev: await chainEntryHash(last),
		at: seq + 1,
		by: device.deviceId,
		body
	});
}

test('the chain accepts one linear history and refuses forks, gaps and rollbacks', async () => {
	const { device, entry } = await genesis();
	const headers = { 'X-Harness-Device': device.deviceId };
	expect(await answer(await f.call(A, 'GET', 'chain', { headers }))).toBe('200 ok');
	expect(await answer(await f.call(A, 'POST', 'chain', { body: entry, headers }))).toBe('201 ok');
	expect(await answer(await f.call(A, 'POST', 'chain', { body: entry, headers }))).toBe(
		'409 chain-conflict'
	);
	const second = await next(device, entry);
	const pending = await sealedDevice();
	const unsigned = {
		...second,
		body: { ...second.body, device: sealedDevicePublic(pending, 'admin', []) }
	};
	expect(await answer(await f.call(A, 'POST', 'chain', { body: unsigned, headers }))).toBe(
		'400 invalid-chain'
	);
	expect(
		await answer(
			await f.call(A, 'POST', 'chain', {
				body: second,
				headers: { 'X-Harness-Device': pending.deviceId }
			})
		)
	).toBe('400 invalid-chain');
	expect(
		await answer(await f.call(A, 'POST', 'chain', { body: { ...second, seq: 3 }, headers }))
	).toBe('409 chain-conflict');
	expect(
		await answer(
			await f.call(A, 'POST', 'chain', { body: { ...second, prev: 'a'.repeat(64) }, headers })
		)
	).toBe('409 chain-conflict');
	expect(await answer(await f.call(A, 'POST', 'chain', { body: second, headers }))).toBe('201 ok');
	const fork = await next(device, entry);
	expect(
		await answer(await f.call(A, 'POST', 'chain', { body: { ...fork, at: 99 }, headers }))
	).toBe('409 chain-conflict');
	const read = (await (await f.call(A, 'GET', 'chain?after=-1', { headers })).json()) as {
		entries: SealedChainEntry[];
		head: number;
	};
	expect(read.entries).toEqual([entry, second]);
	expect(read.head).toBe(1);
	const delta = (await (await f.call(A, 'GET', 'chain?after=0', { headers })).json()) as {
		entries: SealedChainEntry[];
	};
	expect(delta.entries).toEqual([second]);
}, 60_000);

test('the server hashes an entry exactly as the sealed core does', async () => {
	const { device, entry } = await genesis('google:fixture-b');
	const headers = { 'X-Harness-Device': device.deviceId };
	expect(await answer(await f.call(B, 'POST', 'chain', { body: entry, headers }))).toBe('201 ok');
	const stored = await f.db
		.prepare('SELECT hash FROM sealed_chain WHERE account = ? AND seq = 0')
		.bind('google:fixture-b')
		.first<{ hash: string }>();
	expect(stored?.hash).toBe(await chainEntryHash(entry));
}, 60_000);

test('accounts never see each other, and a call needs a session and a device', async () => {
	const { device, entry } = await genesis();
	const headers = { 'X-Harness-Device': device.deviceId };
	expect(await answer(await f.call(null, 'GET', 'chain', { headers }))).toBe(
		'401 session-required'
	);
	expect(await answer(await f.call(A, 'GET', 'chain'))).toBe('400 device-required');
	expect(
		await answer(await f.call(A, 'GET', 'chain', { headers: { 'X-Harness-Device': 'nope' } }))
	).toBe('400 device-required');
	expect(await answer(await f.call(A, 'GET', 'nothing', { headers }))).toBe('404 not-found');
	expect(await answer(await f.call(A, 'DELETE', 'chain', { headers }))).toBe(
		'405 method-not-allowed'
	);
	expect(await answer(await f.call(A, 'POST', 'chain', { body: { seq: 'x' }, headers }))).toBe(
		'400 invalid-input'
	);
	expect(await answer(await f.call(A, 'POST', 'chain', { body: 'not json', headers }))).toBe(
		'400 invalid-input'
	);
	expect(await answer(await f.call(B, 'POST', 'chain', { body: entry, headers }))).toBe(
		'400 invalid-chain'
	);
	const before = (await (await f.call(B, 'GET', 'chain', { headers })).json()) as {
		entries: unknown[];
	};
	expect(before.entries.length).toBeGreaterThan(0);
	const other = await genesis();
	await f.call('session-a-browser', 'POST', 'chain', { body: other.entry, headers });
	const mine = (await (await f.call(B, 'GET', 'chain', { headers })).json()) as {
		entries: SealedChainEntry[];
	};
	expect(mine.entries.every((item) => item.body.type === 'genesis')).toBe(true);
	expect(entry.seq).toBe(0);
}, 60_000);

test('grants are stored once, per device, and only for the signed-in account', async () => {
	const phone = await sealedDevice(),
		mac = await sealedDevice();
	const keys = newScopeKeys();
	const raw = {
		scopeId: keys.scopeId,
		epoch: 0,
		dataKey: crypto.getRandomValues(new Uint8Array(32)),
		indexKey: crypto.getRandomValues(new Uint8Array(32))
	};
	const grant = await sealedGrant('google:fixture-a', raw, sealedDevicePublic(phone, 'admin', []));
	const headers = { 'X-Harness-Device': phone.deviceId };
	expect(await answer(await f.call(A, 'POST', 'grants', { body: grant, headers }))).toBe('201 ok');
	expect(await answer(await f.call(A, 'POST', 'grants', { body: grant, headers }))).toBe('201 ok');
	const rows = await f.db
		.prepare("SELECT COUNT(*) AS n FROM sealed_grants WHERE account = 'google:fixture-a'")
		.first<{ n: number }>();
	expect(rows?.n).toBe(1);
	expect(await answer(await f.call(B, 'POST', 'grants', { body: grant, headers }))).toBe(
		'400 invalid-input'
	);
	expect(
		await answer(await f.call(A, 'POST', 'grants', { body: { ...grant, enc: 'AAAA' }, headers }))
	).toBe('400 invalid-input');
	expect(
		await answer(await f.call(A, 'POST', 'grants', { body: { ...grant, epoch: -1 }, headers }))
	).toBe('400 invalid-input');
	const read = (await (
		await f.call(A, 'GET', `grants?device=${phone.deviceId}`, { headers })
	).json()) as {
		grants: unknown[];
	};
	expect(read.grants).toEqual([grant]);
	const empty = (await (
		await f.call(A, 'GET', `grants?device=${mac.deviceId}`, { headers })
	).json()) as {
		grants: unknown[];
	};
	expect(empty.grants).toEqual([]);
	const hidden = (await (
		await f.call(B, 'GET', `grants?device=${phone.deviceId}`, { headers })
	).json()) as {
		grants: unknown[];
	};
	expect(hidden.grants).toEqual([]);
}, 60_000);
