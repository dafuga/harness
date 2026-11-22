import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { d1OneTimeStores } from '../../src/routes/api/[...path]/d1-auth-store-adapter/d1OneTimeStores';
import type { D1OneTimeStores } from '../../src/utils/networking-security/d1OneTimeStores';
import type { D1Like, D1Statement } from '../../src/routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter.types';
import { AuthRecordValidator } from '../../src/validators/accounts-access/AuthRecordValidator';

function database(rows: unknown[]) {
	const calls: Array<{ query: string; values: unknown[] }> = [];
	const db: D1Like & { calls: Array<{ query: string; values: unknown[] }> } = {
		calls,
		prepare(query) {
			const statement: D1Statement = {
				bind(...values) {
					calls.push({ query, values });
					return statement;
				},
				async run() { return {}; },
				async first<T>() { return (rows.shift() ?? null) as T | null; }
			};
			return statement;
		}
	};
	return db;
}

const challengeRow = { id_hash: 'hash-1', nonce: 'nonce-1', csrf_hash: 'csrf-1', expires_at: 900 };
const exchangeRow = {
	id: 'exchange-1', challenge: 'challenge-1', nonce_hash: 'nonce-hash', code_hash: 'code-hash',
	resource: 'https://example.test', audience: 'desktop-app', action: 'login', environment: 'local',
	origin: 'https://example.test', status: 'approved', subject: 'actor-1', parent_hash: 'parent-1', expires_at: 900
};

test('Challenges create and claim an unexpired record once', async () => {
	const db = database([challengeRow, null]);
	const stores: D1OneTimeStores = d1OneTimeStores(db, new AuthRecordValidator());
	const record = { idHash: 'hash-1', nonce: 'nonce-1', csrfHash: 'csrf-1', expiresAt: 900 };
	await stores.challenges.create(record);
	const claimed = await stores.challenges.claim('hash-1', 100);
	const repeated = await stores.challenges.claim('hash-1', 100);
	expect([claimed, repeated]).toEqual([record, null]);
	recordExampleCases(
		{ unitId: 'hub.function.d1-one-time-stores', symbol: 'd1OneTimeStores', state: 'challenges-create-and-claim-an-unexpired-record-once', evidence: 'examples-cases', file: 'challenges-create-and-claim-an-unexpired-record-once.json' },
		[{ name: 'claim removes the returned challenge', input: { record, now: 100 }, output: { claimed, repeated, insert: db.calls[0]?.values } }]
	);
});

test('Native exchanges approve matching pending records and claim', async () => {
	const db = database([{ id: 'exchange-1' }, exchangeRow]);
	const stores: D1OneTimeStores = d1OneTimeStores(db, new AuthRecordValidator());
	const approval = { id: 'exchange-1', codeHash: 'code-hash', subject: 'actor-1', parentHash: 'parent-1', now: 100 };
	const approved = await stores.exchanges.approve(approval);
	const claimed = await stores.exchanges.claim('exchange-1', 100);
	expect(approved).toBe(true);
	expect(claimed).toMatchObject({ id: 'exchange-1', status: 'approved', subject: 'actor-1' });
	recordExampleCases(
		{ unitId: 'hub.function.d1-one-time-stores', symbol: 'd1OneTimeStores', state: 'native-exchanges-approve-matching-pending-records-and-claim', evidence: 'examples-cases', file: 'native-exchanges-approve-matching-pending-records-and-claim.json' },
		[{ name: 'matching approval and approved exchange claim', input: approval, output: { approved, claimed: { id: claimed?.id, status: claimed?.status, subject: claimed?.subject } } }]
	);
});

test('Throws Error when a claimed challenge row fails validation', async () => {
	const db = database([{ id_hash: '', nonce: 'nonce-1', csrf_hash: 'csrf-1', expires_at: 900 }]);
	const stores = d1OneTimeStores(db, new AuthRecordValidator());
	const error = await stores.challenges.claim('hash-1', 100).then(
		() => 'no error',
		(reason: unknown) => reason instanceof Error ? reason.message : String(reason)
	);
	expect(error).toBe('Hub auth record corrupt');
	recordExampleCases(
		{ unitId: 'hub.function.d1-one-time-stores', symbol: 'challenges.claim', state: 'throws-error-when-a-claimed-challenge-row-fails-validation', evidence: 'examples-cases', file: 'throws-error-when-a-claimed-challenge-row-fails-validation.json' },
		[{ name: 'invalid challenge row', input: { idHash: 'hash-1', now: 100 }, error }]
	);
});

test('Throws database rejection when a store operation fails', async () => {
	const failure = new Error('database unavailable');
	const db: D1Like = { prepare() { throw failure; } };
	const stores = d1OneTimeStores(db, new AuthRecordValidator());
	const error = await stores.challenges.claim('hash-1', 100).then(
		() => 'no error',
		(reason: unknown) => reason === failure ? failure.message : String(reason)
	);
	expect(error).toBe('database unavailable');
	recordExampleCases(
		{ unitId: 'hub.function.d1-one-time-stores', symbol: 'challenges.claim', state: 'throws-database-rejection-when-a-store-operation-fails', evidence: 'examples-cases', file: 'throws-database-rejection-when-a-store-operation-fails.json' },
		[{ name: 'database prepare rejects', input: { idHash: 'hash-1', now: 100 }, error }]
	);
});
