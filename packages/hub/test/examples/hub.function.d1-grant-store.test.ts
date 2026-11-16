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
