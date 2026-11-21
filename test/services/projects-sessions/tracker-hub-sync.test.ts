import { expect, test, vi } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import {
	auth,
	expectJson,
	hubFixture,
	operation,
	pullPage,
	signedRequest,
	textStream,
	timestamp,
	unit
} from './trackerHubFixture';

test('push receipt, duplicate retry and bounded pull preserve hub sequencing and operation authorship', async () => {
	await measureWorkload(unit, 'signed-push-retry-and-pull', async () => {
		const { send, store } = hubFixture({
			duePolicy: () => ({ paused: false, local_due: true, at: timestamp })
		});
		const next = { ...operation, op_id: 'spoke:2', seq: 80 };
		const push = {
			method: 'POST',
			path: '/sync/push',
			text: JSON.stringify({ node: 'relay', ops: [operation, next] })
		} as const;
		await expectJson(await send(push), 200, { ok: true, applied: 2, db_id: 'fixture-db', last: 2 });
		await expectJson(await send(push), 200, { ok: true, applied: 0, db_id: 'fixture-db', last: 2 });
		await expectJson(
			await send({ method: 'GET', path: '/sync/pull?since=0&limit=1&wait=60' }),
			200,
			{
				...pullPage([{ ...operation, seq: 1 }], 1, 2),
				due_policy: { paused: false, local_due: true, at: timestamp }
			}
		);
		await expectJson(await send({ method: 'GET', path: '/sync/pull?since=1&limit=9999' }), 200, {
			...pullPage([{ ...next, seq: 2 }], 2, 2),
			due_policy: { paused: false, local_due: true, at: timestamp }
		});
		expect(store.opsSince.mock.calls).toEqual([
			[0, 1],
			[1, 5000]
		]);
	});
});

test('pull rewinds an ahead cursor immediately and omits absent due policy', async () => {
	const { send, store } = hubFixture();
	store.applyOps([operation]);
	await expectJson(
		await send({ method: 'GET', path: '/sync/pull?since=90&wait=60' }),
		200,
		pullPage([], 1, 1)
	);
	await expectJson(
		await send({ method: 'GET', path: '/sync/pull??since=90' }),
		200,
		pullPage([{ ...operation, seq: 1 }], 1, 1)
	);
	expect(store.subscribe).not.toHaveBeenCalled();
});

test('signed health reports the journal identity and tracks reported nodes without exposing mutable state', async () => {
	const { hub, send, store } = hubFixture();
	store.applyOps([operation]);
	const snapshot = hub.peers();
	for (const node of [null, '__proto__']) {
		await expectJson(await send({ method: 'GET', path: '/sync/health', node }), 200, {
			ok: true,
			hub: 'fixture-hub',
			db_id: 'fixture-db',
			max: 1
		});
	}
	expect(snapshot).toStrictEqual({});
	const at = new Date(timestamp).toISOString();
	expect(hub.peers()).toStrictEqual({ '?': at, ['__proto__']: at });
	await expectJson(await send({ method: 'POST', path: '/sync/health', text: '{}' }), 404, {
		error: 'not found'
	});
});

test('authorization covers the method, exact target and raw POST bytes before any store is accessed', async () => {
	const permitDue = vi.fn(() => true);
	const { hub, store } = hubFixture({ permitDue });
	const pull = signedRequest({ method: 'GET', path: '/sync/pull?since=0&fixture=%2f' });
	const push = signedRequest({ method: 'POST', path: '/sync/push', text: '{}' });
	const expired = new Headers({
		authorization: auth.authorizationHeader(
			{ method: 'GET', pathAndQuery: '/sync/health' },
			timestamp - 300_001
		)
	});
	for (const request of [
		{ ...pull, pathAndQuery: '/sync/pull?fixture=%2f&since=0' },
		{ ...pull, pathAndQuery: '/sync/pull?since=0&fixture=%2F' },
		{ ...pull, pathAndQuery: '/other/../sync/pull?since=0&fixture=%2f' },
		{ ...push, method: 'GET' },
		{ ...push, body: textStream('{ }') },
		{ ...pull, pathAndQuery: '/sync/health', headers: expired },
		{ ...pull, headers: new Headers({ 'x-tracker-node': 'fixture-spoke' }) }
	])
		await expectJson(await hub.handle(request), 401, { error: 'unauthorized' });
	expect(hub.peers()).toStrictEqual({});
	expect(store.opsSince).not.toHaveBeenCalled();
	expect(store.applyOps).not.toHaveBeenCalled();
	expect(permitDue).not.toHaveBeenCalled();
	await expectJson(await hub.handle(pull), 200, pullPage([], 0, 0));
});

test('due permission passes the signed payload and reported node to the injected policy', async () => {
	const permitDue = vi.fn(
		(id, token, node) =>
			id === 'fixture-item' && token === 'fixture-token' && node === 'fixture-spoke'
	);
	const { send } = hubFixture({ permitDue });
	const due = {
		method: 'POST',
		path: '/sync/permit-due',
		text: '{"id":"fixture-item","token":"fixture-token"}'
	} as const;
	await expectJson(await send(due), 200, { allowed: true });
	await expectJson(await send({ ...due, node: 'other-spoke' }), 200, { allowed: false });
	await expectJson(await send({ ...due, text: '{"id":"fixture-item","token":4}' }), 200, {
		allowed: false
	});
	await expectJson(await hubFixture().send(due), 200, { allowed: false });
	expect(permitDue.mock.calls).toEqual([
		['fixture-item', 'fixture-token', 'fixture-spoke'],
		['fixture-item', 'fixture-token', 'other-spoke']
	]);
});

test('machine telemetry attributes samples and runs to the reported sender and returns fleet data', async () => {
	const sample = { node: 'payload-node', at: '2023-11-14T22:13:20Z', cpu_count: 4 };
	const machines = { record: vi.fn(), latestSamples: () => [{ ...sample, node: 'fixture-spoke' }] };
	const runs = {
		importRemote: vi.fn(),
		historyRowsFor: vi.fn(() => [{ id: 'other-run', node: 'fixture-hub' }])
	};
	const history = [{ id: 'spoke-run', result: 'done' }];
	const machine = {
		method: 'POST',
		path: '/sync/machine',
		text: JSON.stringify({ sample, runs: history })
	} as const;
	await expectJson(await hubFixture({ machines, runs: () => runs }).send(machine), 200, {
		ok: true,
		machines: [{ ...sample, node: 'fixture-spoke' }],
		run_history: [{ id: 'other-run', node: 'fixture-hub' }]
	});
	expect(machines.record).toHaveBeenCalledWith({ ...sample, node: 'fixture-spoke' });
	expect(runs.importRemote).toHaveBeenCalledWith('fixture-spoke', history);
	expect(runs.historyRowsFor).toHaveBeenCalledWith('fixture-spoke');
	await expectJson(await hubFixture({ machines }).send({ ...machine, text: '{}' }), 200, {
		ok: true,
		machines: [{ ...sample, node: 'fixture-spoke' }]
	});
	await expectJson(await hubFixture().send(machine), 404, {
		error: 'machine tracking disabled on the hub'
	});
});
