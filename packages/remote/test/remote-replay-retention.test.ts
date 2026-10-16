import { expect, test } from 'vitest';
import { ResponseLedgerService } from '../src/services/ResponseLedgerService';

test('an expired answer cannot cause the original mutation to execute again', async () => {
	let now = 1;
	let writes = 0;
	const ledger = new ResponseLedgerService({ capacity: 2, ttlMs: 10, now: () => now });
	const request = { id: 'same-logical-operation', digest: 'same-input' };
	const execute = async () => ++writes;
	await ledger.run(request, execute);
	now = 100;
	await ledger.run(request, execute).catch(() => undefined);
	expect(writes).toBe(1);
});

test('evicting response payloads cannot allow an earlier mutation ID to run again', async () => {
	let writes = 0;
	const ledger = new ResponseLedgerService({ capacity: 2, ttlMs: 10_000 });
	const first = { id: 'first-operation', digest: 'first-input' };
	const execute = async () => ++writes;
	await ledger.run(first, execute);
	await ledger.run({ id: 'second-operation', digest: 'second-input' }, async () => 'second');
	await ledger
		.run({ id: 'third-operation', digest: 'third-input' }, async () => 'third')
		.catch(() => undefined);
	await ledger.run(first, execute).catch(() => undefined);
	expect(writes).toBe(1);
});
