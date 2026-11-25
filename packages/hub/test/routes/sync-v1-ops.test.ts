import { afterAll, beforeAll, expect, test } from 'vitest';
import { toBase64Url } from '../../../remote/src/utils/networking-security/remoteBytes';
import { sealedRecord } from '../../../remote/src/utils/networking-security/sealedRecord';
import {
	newScopeKeys,
	sealedScopeKeys
} from '../../../remote/src/utils/networking-security/sealedScopeKeys';
import type { ScopeKeys } from '../../../remote/src/models/networking-security/Sealed.types';
import { startSync } from '../support/syncFixture';
import type { SyncFixture } from '../support/syncFixture.types';

/** The op log and object endpoints in workerd with a real D1 database and R2 bucket. */
let f: SyncFixture;
beforeAll(async () => {
	f = await startSync();
}, 120_000);
afterAll(async () => {
	await f?.stop();
});

const A = 'session-a',
	B = 'session-b';
const device = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
const headers = { 'X-Harness-Device': device };
const answer = async (response: Response) => {
	const body = (await response.json()) as { error?: string };
	return `${response.status} ${body.error ?? 'ok'}`;
};
const random = (size: number) => crypto.getRandomValues(new Uint8Array(size));

async function scope(): Promise<{ keys: ScopeKeys; id: string }> {
	const raw = newScopeKeys();
	return { keys: await sealedScopeKeys(raw), id: toBase64Url(raw.scopeId) };
}

async function envelope(keys: ScopeKeys, objectId: Uint8Array, revision: bigint, value: object) {
	return toBase64Url(await sealedRecord(keys, { objectId, revision }, value));
}

test('ops are numbered by the server, retries are harmless and scopes are checked', async () => {
	const { keys, id } = await scope();
	const other = await scope();
	const first = await envelope(keys, random(32), 0n, { n: 1 });
	const second = await envelope(keys, random(32), 0n, { n: 2 });
	const posted = await f.call(A, 'POST', `ops/${id}`, { body: [first, second], headers });
	expect(posted.status).toBe(201);
	const body = (await posted.json()) as { ops: { seq: number }[]; head: number };
	expect(body.ops.map((op) => op.seq)).toEqual([1, 2]);
	expect(body.head).toBe(2);
	const retry = (await (
		await f.call(A, 'POST', `ops/${id}`, { body: [second], headers })
	).json()) as {
		ops: { seq: number }[];
	};
	expect(retry.ops.map((op) => op.seq)).toEqual([2]);
	const third = await envelope(keys, random(32), 0n, { n: 3 });
	const later = (await (
		await f.call(A, 'POST', `ops/${id}`, { body: [third], headers })
	).json()) as {
		head: number;
	};
	expect(later.head).toBe(3);
	const wrong = await envelope(other.keys, random(32), 0n, { n: 4 });
	await refused(id, first, wrong);
	await paged(id, [second, third]);
}, 60_000);

async function refused(id: string, first: string, wrong: string) {
	expect(await answer(await f.call(A, 'POST', `ops/${id}`, { body: [wrong], headers }))).toBe(
		'400 invalid-input'
	);
	expect(await answer(await f.call(A, 'POST', `ops/${id}`, { body: ['AAAA'], headers }))).toBe(
		'400 invalid-input'
	);
	expect(await answer(await f.call(A, 'POST', `ops/${id}`, { body: [], headers }))).toBe(
		'400 invalid-input'
	);
	expect(await answer(await f.call(A, 'POST', `ops/${id}`, { body: { ops: [] }, headers }))).toBe(
		'400 invalid-input'
	);
	expect(await answer(await f.call(A, 'POST', 'ops/short', { body: [first], headers }))).toBe(
		'400 invalid-input'
	);
}

async function paged(id: string, [second, third]: string[]) {
	const read = (await (
		await f.call(A, 'GET', `ops/${id}?after=1&limit=1`, { headers })
	).json()) as {
		ops: { seq: number; envelope: string; device: string }[];
		next: number;
		more: boolean;
	};
	expect(read.ops).toMatchObject([{ seq: 2, envelope: second, device }]);
	expect([read.next, read.more]).toEqual([2, true]);
	const rest = (await (await f.call(A, 'GET', `ops/${id}?after=2`, { headers })).json()) as {
		ops: { envelope: string }[];
		more: boolean;
	};
	expect(rest.ops.map((op) => op.envelope)).toEqual([third]);
	expect(rest.more).toBe(false);
	const hidden = (await (await f.call(B, 'GET', `ops/${id}`, { headers })).json()) as {
		ops: unknown[];
	};
	expect(hidden.ops).toEqual([]);
}

test('an object keeps its newest revision, small in D1 and large in R2', async () => {
	const { keys, id } = await scope();
	const small = random(32),
		large = random(32);
	const smallId = toBase64Url(small),
		largeId = toBase64Url(large);
	const v1 = await envelope(keys, small, 1n, { small: 1 });
	const v2 = await envelope(keys, small, 2n, { small: 2 });
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${smallId}`, { body: v1, headers }))
	).toBe('201 ok');
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${smallId}`, { body: v1, headers }))
	).toBe('409 stale-revision');
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${smallId}`, { body: v2, headers }))
	).toBe('201 ok');
	const got = await f.call(A, 'GET', `objects/${id}/${smallId}`, { headers });
	expect([got.status, got.headers.get('X-Sealed-Revision'), await got.text()]).toEqual([
		200,
		'2',
		v2
	]);
	const big = await envelope(keys, large, 1n, { text: 'x'.repeat(200_000) });
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${largeId}`, { body: big, headers }))
	).toBe('201 ok');
	const row = await f.db
		.prepare('SELECT r2_key, envelope FROM sealed_objects WHERE object_id = ?')
		.bind(largeId)
		.first<{ r2_key: string; envelope: string | null }>();
	expect(row?.envelope).toBeNull();
	expect((await f.bucket.get(row?.r2_key ?? ''))?.size).toBeGreaterThan(200_000);
	expect(await (await f.call(A, 'GET', `objects/${id}/${largeId}`, { headers })).text()).toBe(big);
	const bigger = await envelope(keys, large, 2n, { text: 'y'.repeat(300_000) });
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${largeId}`, { body: bigger, headers }))
	).toBe('201 ok');
	expect(await f.bucket.get(row?.r2_key ?? '')).toBeNull();
	const list = (await (await f.call(A, 'GET', `objects/${id}?after=0`, { headers })).json()) as {
		objects: { id: string; revision: number; change: number }[];
		next: number;
	};
	expect(list.objects.map((item) => [item.id, item.revision])).toEqual([
		[smallId, 2],
		[largeId, 2]
	]);
	const changed = (await (
		await f.call(A, 'GET', `objects/${id}?after=${list.objects[0].change}`, { headers })
	).json()) as {
		objects: { id: string }[];
	};
	expect(changed.objects.map((item) => item.id)).toEqual([largeId]);
}, 60_000);

test('an object write must match its address, and another account sees nothing', async () => {
	const { keys, id } = await scope();
	const object = random(32),
		objectId = toBase64Url(object);
	const text = await envelope(keys, object, 1n, { a: 1 });
	expect(
		await answer(
			await f.call(A, 'PUT', `objects/${id}/${toBase64Url(random(32))}`, { body: text, headers })
		)
	).toBe('400 invalid-input');
	expect(
		await answer(
			await f.call(A, 'PUT', `objects/${(await scope()).id}/${objectId}`, { body: text, headers })
		)
	).toBe('400 invalid-input');
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${objectId}`, { body: 'AAAA', headers }))
	).toBe('400 invalid-input');
	const huge = await envelope(keys, object, 2n, { text: 'z'.repeat(5_000_000) });
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${objectId}`, { body: huge, headers }))
	).toBe('413 too-large');
	expect(
		await answer(await f.call(A, 'PUT', `objects/${id}/${objectId}`, { body: text, headers }))
	).toBe('201 ok');
	expect(await answer(await f.call(B, 'GET', `objects/${id}/${objectId}`, { headers }))).toBe(
		'404 not-found'
	);
	expect(await answer(await f.call(null, 'GET', `objects/${id}/${objectId}`, { headers }))).toBe(
		'401 session-required'
	);
}, 60_000);
