import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { ResponseLedgerService } from '../../src/services/ResponseLedgerService';
import { deferred } from '../support/wireHarness';

const manifest = JSON.parse(
	readFileSync(
		new URL(
			'../../../../test/fixtures/contract-migration/response-ledger-methods.json',
			import.meta.url
		),
		'utf8'
	)
) as { testing: { cases: { id: string; test: { title: string } }[] } };
const contractCase = manifest.testing.cases.find((item) => item.id === 'run-initialized');

function counted() {
	const state = { runs: 0 };
	return { state, execute: async () => ({ run: ++state.runs }) };
}
const entry = (id: string, digest = 'd') => ({ id, digest });

test('run initialized preserves answers, failures, retention and capacity boundaries', async () => {
	expect(contractCase?.test.title).toBe(expect.getState().currentTestName);
	await assertSettledReplay();
	await assertPendingReplay();
	await assertDigestConflict();
	await assertFailedReplay();
	await assertRetention();
	await assertPendingCapacity();
});

async function assertSettledReplay() {
	const ledger = new ResponseLedgerService(),
		{ state, execute } = counted();
	expect(await ledger.run(entry('a'), execute)).toEqual({ run: 1 });
	expect(await ledger.run(entry('a'), execute)).toEqual({ run: 1 });
	expect(state.runs).toBe(1);
}

async function assertPendingReplay() {
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
}

async function assertDigestConflict() {
	const ledger = new ResponseLedgerService(),
		{ state, execute } = counted();
	await ledger.run(entry('a'), execute);
	await expect(ledger.run(entry('a', 'other'), execute)).rejects.toMatchObject({
		code: 'request-conflict'
	});
	expect(state.runs).toBe(1);
}

async function assertFailedReplay() {
	const ledger = new ResponseLedgerService();
	let runs = 0;
	const execute = async () => {
		runs++;
		throw new Error('refused');
	};
	await expect(ledger.run(entry('a'), execute)).rejects.toThrow('refused');
	await expect(ledger.run(entry('a'), execute)).rejects.toThrow('refused');
	expect(runs).toBe(1);
}

async function assertRetention() {
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
}

async function assertPendingCapacity() {
	const ledger = new ResponseLedgerService({ capacity: 1 }),
		gate = deferred<string>();
	const waiting = ledger.run(entry('a'), () => gate.promise);
	await expect(ledger.run(entry('b'), async () => 'b')).rejects.toMatchObject({
		code: 'too-many-requests'
	});
	gate.resolve('a');
	expect(await waiting).toBe('a');
}
