import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { d1EmailStores } from '../../src/routes/api/[...path]/d1-auth-store-adapter/d1EmailStores';
import { EMAIL_PURGES } from '../../src/utils/networking-security/d1EmailStores';
import type { D1EmailStores } from '../../src/utils/networking-security/d1EmailStores.types';
import type { D1Like, D1Statement } from '../../src/routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter.types';

const state = 'email-stores-bind-conditional-queries-and-validate-rows';

function database(): { db: D1Like; calls: Array<{ query: string; values: unknown[] }> } {
	const calls: Array<{ query: string; values: unknown[] }> = [];
	const db: D1Like = {
		prepare(query) {
			let values: unknown[] = [];
			const statement: D1Statement = {
				bind(...bound) {
					values = bound;
					return statement;
				},
				async first<T>() {
					calls.push({ query, values });
					let result: Record<string, unknown> | null = null;
					if (query.includes('RETURNING')) {
						result = query.includes('auth_email_proofs')
							? {
								id_hash: 'proof-hash', actor_id: 'actor-1', actor_email: 'person@example.test',
								actor_name: 'Example Person', code_hash: 'code-hash', code_expires_at: 9000,
								attempts: 1, claimed: 1, expires_at: 12000
							}
							: { send_count: 2 };
					}
					return result as T | null;
				},
				async run() {
					calls.push({ query, values });
					return {};
				}
			};
			return statement;
		}
	};
	return { db, calls };
}

test('Email stores bind conditional queries and validate rows', async () => {
	const { db, calls } = database();
	const records = {
		emailProof: (row: Record<string, unknown>) => ({ idHash: row.id_hash, attempts: row.attempts }),
		verifiedEmail: (row: Record<string, unknown>) => ({ actorId: row.actor_id, emailHash: row.email_hash })
	};
	const stores: D1EmailStores = d1EmailStores(db, records as never);
	const issued = await stores.emailProofs.issue({ idHash: 'proof-hash', codeHash: 'new-code', codeExpiresAt: 9000, now: 1000 });
	const attempted = await stores.emailProofs.attempt({ idHash: 'proof-hash', codeHash: 'new-code', limit: 5, now: 1100 });
	const allowed = await stores.emailLedger.allow({ key: 'actor-1', day: 3, now: 1200, since: 800, cap: 4 });
	await stores.emailLedger.prove({ actorId: 'actor-1', emailHash: 'email-hash', verifiedAt: 1200, expiresAt: 5000 });
	expect({ issued, allowed, attempted, purgeCount: EMAIL_PURGES.length }).toEqual({
		issued: true,
		allowed: true,
		attempted: { idHash: 'proof-hash', attempts: 1 },
		purgeCount: 3
	});
	recordExampleCases(
		{ unitId: 'hub.function.d1-email-stores', symbol: 'd1EmailStores', state, evidence: 'examples-cases', file: `${state}.json` },
		[
			{ name: 'live proof accepts a replacement code', input: { idHash: 'proof-hash', codeHash: 'new-code', now: 1000 }, output: { issued, query: calls[0]?.query, bindings: calls[0]?.values } },
			{ name: 'matching attempt returns the validated proof', input: { idHash: 'proof-hash', codeHash: 'new-code', limit: 5 }, output: attempted },
			{ name: 'send within cap is allowed and verified address is stored', input: { key: 'actor-1', day: 3, cap: 4 }, output: { allowed, writeCount: calls.filter((call) => call.query.startsWith('INSERT OR REPLACE')).length } },
			{ name: 'purge statements cover all email records', input: { cutoff: 5000 }, output: EMAIL_PURGES }
		]
	);
});
