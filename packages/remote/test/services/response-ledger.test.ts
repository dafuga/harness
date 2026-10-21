import { expect, test } from 'vitest';
import { ResponseLedgerService } from '../../src/services/ResponseLedgerService';
import { deferred } from '../support/wireHarness';
import { taskProfile } from '../../../../test/support/taskProfiles';

function counted() {
	const state = { runs: 0 };
	return { state, execute: async () => ({ run: ++state.runs }) };
}
const entry = (id: string, digest = 'd') => ({ id, digest });

test('the same id and digest runs once and returns the first answer', async () => {
	const ledger = new ResponseLedgerService(),
		{ state, execute } = counted();
	expect(await ledger.run(entry('a'), execute)).toEqual({ run: 1 });
	expect(await ledger.run(entry('a'), execute)).toEqual({ run: 1 });
	expect(state.runs).toBe(1);
	await taskProfile(
		'remote.service.response-ledger',
		'create-and-replay-one-mutation',
		async () => {
			const current = new ResponseLedgerService();
			const operation = counted();
			const first = current.run(entry('profile'), operation.execute);
			const second = current.run(entry('profile'), operation.execute);
			if (first !== second) throw new Error('Replay replaced the original answer promise');
			const answers = await Promise.all([first, second]);
			if (operation.state.runs !== 1) throw new Error('Replay repeated the mutation');
			return answers;
		}
	);
});
test('a re-send joins an answer that is still being produced', async () => {
	const ledger = new ResponseLedgerService(),
		gate = deferred<string>();
	let runs = 0;
	const execute = () => {
		runs++;
		return gate.promise;
	};
	const first = ledger.run(entry('a'), execute),
		second = ledger.run(entry('a'), execute);
	gate.resolve('done');
	expect(await Promise.all([first, second])).toEqual(['done', 'done']);
	expect(runs).toBe(1);
});
test('the same id with another digest is a conflict and runs nothing', async () => {
	const ledger = new ResponseLedgerService(),
		{ state, execute } = counted();
	await ledger.run(entry('a'), execute);
	await expect(ledger.run(entry('a', 'other'), execute)).rejects.toMatchObject({
		code: 'request-conflict'
	});
	expect(state.runs).toBe(1);
});
test('a failed operation is remembered as failed, not retried', async () => {
	const ledger = new ResponseLedgerService();
	let runs = 0;
	const execute = async () => {
		runs++;
		throw new Error('refused');
	};
	await expect(ledger.run(entry('a'), execute)).rejects.toThrow('refused');
	await expect(ledger.run(entry('a'), execute)).rejects.toThrow('refused');
	expect(runs).toBe(1);
});
test('an expired or evicted answer is refused, and its operation never runs again', async () => {
	let now = 1000;
	const expiring = new ResponseLedgerService({ ttlMs: 1000, now: () => now }),
		first = counted();
	await expiring.run(entry('a'), first.execute);
	now += 1001;
	await expect(expiring.run(entry('a'), first.execute)).rejects.toMatchObject({
		code: 'request-expired'
	});
	expect(first.state.runs).toBe(1);
	const small = new ResponseLedgerService({ capacity: 2 }),
		second = counted();
	for (const id of ['a', 'b', 'c', 'b']) await small.run(entry(id), second.execute);
	await expect(small.run(entry('a'), second.execute)).rejects.toMatchObject({
		code: 'request-expired'
	});
	expect(second.state.runs).toBe(3);
});
test('a ledger full of unfinished operations refuses new ones', async () => {
	const ledger = new ResponseLedgerService({ capacity: 1 }),
		gate = deferred<string>();
	const waiting = ledger.run(entry('a'), () => gate.promise);
	await expect(ledger.run(entry('b'), async () => 'b')).rejects.toMatchObject({
		code: 'too-many-requests'
	});
	gate.resolve('a');
	expect(await waiting).toBe('a');
});
