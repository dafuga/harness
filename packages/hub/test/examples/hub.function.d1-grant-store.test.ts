import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { EXPIRE_GRANTS, d1GrantStore } from '../../src/routes/api/[...path]/d1-auth-store-adapter/d1GrantStore';

const grant = {
	actorId: 'actor-example-17',
	githubUserId: 731,
	login: 'sample-login',
	tokenCipher: 'sealed-access-token',
	tokenExpiresAt: 1_800_000_000,
	refreshCipher: 'sealed-refresh-token',
	refreshExpiresAt: 1_900_000_000,
	createdAt: 1_700_000_000,
	expiresAt: 1_950_000_000
};

function matchedDatabase() {
	const queries: Array<{ sql: string; values: unknown[] }> = [];
	const db = {
		prepare(sql: string) {
			return {
				bind(...values: unknown[]) {
					queries.push({ sql, values });
					return {
						async first() {
							return { generation: 2 };
						},
						async run() {}
					};
				}
			};
		}
	};
	return { db, queries };
}

test('Grant operations update versioned rows', async () => {
	const { db, queries } = matchedDatabase();
	const records = { grantState: (row: unknown) => ({ generation: 2, grant: row, refreshingUntil: null }) };
	const store = d1GrantStore(db as never, records as never);
	const lease = { actorId: grant.actorId, generation: 2, now: 1_710_000_000, until: 1_710_000_300 };
	const read = await store.read(grant.actorId);
	const connected = await store.connect(1, grant);
	const leased = await store.lease(lease);
	const rotated = await store.rotate(lease, { ...grant, tokenCipher: 'sealed-next-token' });
	await store.revoke(grant.actorId, 1_720_000_000);
	const revoked = await store.revokeLeased(lease, 1_720_000_001);
	const output = {
		read,
		connected,
		leased,
		rotated,
		revokeResolved: true,
		revoked,
		queryCount: queries.length,
		expiresOldGrants: EXPIRE_GRANTS.includes('expires_at <= ? AND revoked_at IS NULL')
	};
	expect(output).toEqual({
		read: { generation: 2, grant: { generation: 2 }, refreshingUntil: null },
		connected: true,
		leased: true,
		rotated: true,
		revokeResolved: true,
		revoked: true,
		queryCount: 6,
		expiresOldGrants: true
	});
	recordExampleCases(
		{
			unitId: 'hub.function.d1-grant-store',
			symbol: 'd1GrantStore',
			state: 'grant-operations-update-versioned-rows',
			evidence: 'examples-cases',
			file: 'grant-operations-update-versioned-rows.json'
		},
		[
			{
				name: 'store reads and conditionally updates a versioned grant',
				input: { actorId: grant.actorId, expectedGeneration: 1, leaseGeneration: 2 },
				output
			}
		]
	);
});

test('Throws TypeError when record or lease arguments are null', async () => {
	const { db } = matchedDatabase();
	const store = d1GrantStore(db as never, { grantState: (row: unknown) => row } as never);
	const calls = [
		() => store.connect(0, null as never),
		() => store.lease(null as never),
		() => store.rotate(null as never, grant),
		() => store.revokeLeased(null as never, 1)
	];
	for (const call of calls) expect(call).toThrow(TypeError);
	const output = { thrown: calls.length };
	expect(output.thrown).toBe(4);
	recordExampleCases(
		{ unitId: 'hub.function.d1-grant-store', symbol: 'd1GrantStore', state: 'throws-typeerror-when-record-or-lease-arguments-are-null', evidence: 'examples-cases', file: 'throws-typeerror-when-record-or-lease-arguments-are-null.json' },
		[{ name: 'null record and lease arguments throw synchronously', input: { methods: ['connect', 'lease', 'rotate', 'revokeLeased'] }, output }]
	);
});

test('Throws db error when a query operation fails', async () => {
	const failure = new Error('database unavailable');
	const db = { prepare() { throw failure; } };
	const store = d1GrantStore(db as never, { grantState: (row: unknown) => row } as never);
	await expect(store.connect(0, grant)).rejects.toBe(failure);
	const output = { error: failure.message };
	recordExampleCases(
		{ unitId: 'hub.function.d1-grant-store', symbol: 'd1GrantStore.connect', state: 'throws-db-error-when-a-query-operation-fails', evidence: 'examples-cases', file: 'throws-db-error-when-a-query-operation-fails.json' },
		[{ name: 'prepare failure rejects the store operation', input: { actorId: grant.actorId }, output }]
	);
});

test('Throws records grantState error when an existing row is read', async () => {
	const failure = new Error('invalid grant row');
	const { db } = matchedDatabase();
	const records = { grantState() { throw failure; } };
	const store = d1GrantStore(db as never, records as never);
	await expect(store.read(grant.actorId)).rejects.toBe(failure);
	const output = { error: failure.message };
	recordExampleCases(
		{ unitId: 'hub.function.d1-grant-store', symbol: 'd1GrantStore.read', state: 'throws-records-grantstate-error-when-an-existing-row-is-read', evidence: 'examples-cases', file: 'throws-records-grantstate-error-when-an-existing-row-is-read.json' },
		[{ name: 'validator failure rejects read for an existing row', input: { actorId: grant.actorId }, output }]
	);
});
