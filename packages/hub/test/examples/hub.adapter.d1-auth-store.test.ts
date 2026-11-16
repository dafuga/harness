import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { D1AuthStoreAdapter } from '../../src/routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter';
import type { D1Statement, D1Like } from '../../src/routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter.types';

function cleanupDatabase(calls: Array<{ query: string; values: unknown[] }>): D1Like {
	return {
		prepare(query: string): D1Statement {
			return {
				bind(...values: unknown[]): D1Statement {
					calls.push({ query, values });
					return this;
				},
				async first<T>(): Promise<T | null> {
					return null;
				},
				async run(): Promise<unknown> {
					return { success: true };
				}
			};
		}
	};
}

test('purge binds the cutoff to each cleanup statement in order', async () => {
	const calls: Array<{ query: string; values: unknown[] }> = [];
	const store = new D1AuthStoreAdapter(cleanupDatabase(calls));
	const now = 1760000000000;
	const output = await store.purge(now).then(() => ({ result: null, calls }));
	expect(output.result).toBeNull();
	expect(output.calls.length).toBeGreaterThan(0);
	expect(output.calls.every((call) => call.values[0] === now)).toBe(true);
	recordExampleCases(
		{
			unitId: 'hub.adapter.d1-auth-store',
			symbol: 'D1AuthStoreAdapter.purge',
			state: 'purge-binds-the-cutoff-to-each-cleanup-statement-in-order',
			evidence: 'examples-cases',
			file: 'purge-binds-the-cutoff-to-each-cleanup-statement-in-order.json'
		},
		[
			{
				name: 'cleanup statements run sequentially with the supplied cutoff',
				input: { now },
				output: { result: null, calls }
			}
		]
	);
}, 20_000);
