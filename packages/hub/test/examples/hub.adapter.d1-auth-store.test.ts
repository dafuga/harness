import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { D1AuthStoreAdapter } from '../../src/routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter';
import type {
	D1Statement,
	D1Like
} from '../../src/routes/api/[...path]/d1-auth-store-adapter/D1AuthStoreAdapter.types';

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

test('Throws Unspecified D1 error when prepare throws', async () => {
	const failure = new Error('D1 prepare failed');
	const db: D1Like = {
		prepare(): D1Statement {
			throw failure;
		}
	};
	const store = new D1AuthStoreAdapter(db);
	let caught: unknown;
	try {
		await store.purge(1760000000000);
	} catch (error) {
		caught = error;
	}
	expect(caught).toBe(failure);
	recordExampleCases(
		{
			unitId: 'hub.adapter.d1-auth-store',
			symbol: 'D1AuthStoreAdapter.purge',
			state: 'throws-unspecified-d1-error-when-prepare-throws',
			evidence: 'examples-cases',
			file: 'throws-unspecified-d1-error-when-prepare-throws.json'
		},
		[
			{
				name: 'prepare exception escapes unchanged',
				input: { now: 1760000000000 },
				error: { name: failure.name, message: failure.message }
			}
		]
	);
}, 20_000);
