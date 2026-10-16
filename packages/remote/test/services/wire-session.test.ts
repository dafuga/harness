import { expect, test } from 'vitest';
import { RemoteFailure, remoteErrorMessages } from '../../src/models/Remote.types';
import type { RemoteAttachment } from '../../src/models/Remote.types';
import { codeOf, deferred, tick, uuid, wireLink, wireSession } from '../support/wireHarness';

const run = { projectId: 'p', text: 'go' };
const attachment = (response: { ok: boolean; value?: unknown } | undefined) =>
	response?.value as RemoteAttachment;

test('nothing runs before attach', async () => {
	const { session, calls } = wireSession(),
		link = wireLink(session);
	expect(codeOf(await link.call('snapshot', { projectId: 'p' }))).toBe('not-attached');
	expect(calls).toEqual([]);
});
test('unknown methods do not exist and ungranted ones are denied before the handler', async () => {
	const { session, calls } = wireSession(),
		link = wireLink(session);
	await link.attach();
	expect(codeOf(await link.call('shell.run', { command: 'id' }))).toBe('unknown-method');
	expect(codeOf(await link.call('openProject'))).toBe('method-denied');
	expect(codeOf(await link.call('connectHosted'))).toBe('method-denied');
	expect(codeOf(await link.call('remote.revokeDevice', { deviceId: 'x' }))).toBe('method-denied');
	expect(calls).toEqual([]);
});
test('frames that are not requests are violations and get no answer', async () => {
	const { session } = wireSession(),
		link = wireLink(session);
	const event = JSON.stringify({ type: 'event', channel: 'run', sequence: 1, value: {} });
	for (const text of ['not json', '[]', event]) await link.link.receive(text);
	expect(link.state.violations).toBe(3);
	expect(link.sent).toEqual([]);
});
test('attach answers role, grant, methods and limits, and refuses another protocol', async () => {
	const { session } = wireSession(),
		link = wireLink(session);
	expect(attachment(await link.attach())).toMatchObject({
		protocol: 1,
		role: 'device',
		replay: 'none',
		sequence: 0,
		epoch: session.events.epoch,
		methods: ['session.attach', 'snapshot', 'startRun', 'cancelRun'],
		grant: { projects: [], agents: true },
		device: { name: 'Fixture phone' },
		limits: { frameBytes: 262144 }
	});
	const other = wireLink(session),
		input = { protocol: 2, client: { kind: 'test', name: 'fixture' }, resume: null };
	expect(codeOf(await other.call('session.attach', input))).toBe('protocol-unsupported');
	expect(codeOf(await other.call('snapshot'))).toBe('not-attached');
});
test('a re-sent mutation is answered from the ledger across connections', async () => {
	const { session, calls } = wireSession(),
		first = wireLink(session),
		id = uuid();
	await first.attach();
	const answered = await first.call('startRun', run, id);
	expect(answered).toMatchObject({ ok: true, value: { echo: run } });
	first.link.close();
	const second = wireLink(session);
	await second.attach();
	expect(await second.call('startRun', { text: 'go', projectId: 'p' }, id)).toEqual(answered);
	expect(calls).toHaveLength(1);
	expect(codeOf(await second.call('startRun', { ...run, text: 'other' }, id))).toBe(
		'request-conflict'
	);
	expect(calls).toHaveLength(1);
	const read = uuid();
	await second.call('snapshot', {}, read);
	await second.call('snapshot', {}, read);
	expect(calls).toHaveLength(3);
});
test('a mutation that outlives its connection completes once and answers the re-send', async () => {
	const gate = deferred<unknown>(),
		state = { runs: 0 };
	const { session } = wireSession({
		handle: () => {
			state.runs++;
			return gate.promise;
		}
	});
	const first = wireLink(session),
		id = uuid();
	await first.attach();
	const lost = first.call('startRun', run, id);
	await tick();
	first.link.close();
	const second = wireLink(session);
	await second.attach();
	const again = second.call('startRun', run, id);
	await tick();
	gate.resolve({ runId: 'r1' });
	expect(await again).toMatchObject({ ok: true, value: { runId: 'r1' } });
	await lost;
	expect(first.answer(id)).toBeUndefined();
	expect(state.runs).toBe(1);
});
test('events share one sequence and are replayed in order after a resume', async () => {
	const { session } = wireSession(),
		first = wireLink(session),
		{ epoch } = attachment(await first.attach());
	session.emit('run', { n: 1 });
	session.emit('run', { n: 2 });
	session.emit('connection', { n: 3 });
	expect(first.events().map((event) => event.sequence)).toEqual([1, 2, 3]);
	first.link.close();
	session.emit('run', { n: 4 });
	session.emit('run', { n: 5 });
	const second = wireLink(session),
		resumed = attachment(await second.attach({ epoch, sequence: 3 }));
	expect(resumed).toMatchObject({ replay: 'resumed', sequence: 5, epoch });
	expect(second.sent[0].type).toBe('response');
	expect(second.events().map((event) => [event.sequence, event.value])).toEqual([
		[4, { n: 4 }],
		[5, { n: 5 }]
	]);
	session.emit('run', { n: 6 });
	expect(second.events().at(-1)?.sequence).toBe(6);
	expect(first.events()).toHaveLength(3);
});
test('a resume point from another epoch or outside the window is a gap', async () => {
	const { session } = wireSession({ limits: { eventLog: 2 } });
	for (let n = 1; n <= 4; n++) session.emit('run', { n });
	const trimmed = wireLink(session),
		epoch = session.events.epoch;
	expect(attachment(await trimmed.attach({ epoch, sequence: 1 })).replay).toBe('gap');
	expect(trimmed.events()).toEqual([]);
	const foreign = wireLink(session);
	expect(attachment(await foreign.attach({ epoch: 'f'.repeat(32), sequence: 4 })).replay).toBe(
		'gap'
	);
	expect(foreign.events()).toEqual([]);
});
test('events and requests stay inside the session that owns them', async () => {
	const a = wireSession(),
		b = wireSession(),
		toA = wireLink(a.session),
		toB = wireLink(b.session);
	await toA.attach();
	await toB.attach();
	a.session.emit('run', { owner: 'a' });
	await toA.call('snapshot', { projectId: 'p' });
	expect(toA.events()).toHaveLength(1);
	expect(toB.events()).toEqual([]);
	expect(b.calls).toEqual([]);
	expect(a.session.events.epoch).not.toBe(b.session.events.epoch);
});
test('an ended session drops late answers and accepts nothing more', async () => {
	const gate = deferred<unknown>(),
		{ session } = wireSession({ handle: () => gate.promise }),
		link = wireLink(session),
		id = uuid();
	await link.attach();
	const pending = link.call('startRun', run, id);
	await tick();
	session.end();
	gate.resolve({ runId: 'late' });
	await pending;
	session.emit('run', { late: true });
	const before = link.sent.length;
	await link.call('snapshot');
	expect(link.answer(id)).toBeUndefined();
	expect(link.events()).toEqual([]);
	expect(link.sent).toHaveLength(before);
	expect(session.ended).toBe(true);
});
test('requests beyond the concurrency bound are refused', async () => {
	const gate = deferred<unknown>(),
		{ session } = wireSession({ limits: { pendingRequests: 2 }, handle: () => gate.promise }),
		link = wireLink(session);
	await link.attach();
	const waiting = [link.call('snapshot'), link.call('snapshot')];
	await tick();
	expect(codeOf(await link.call('snapshot'))).toBe('too-many-requests');
	gate.resolve({});
	expect((await Promise.all(waiting)).every((response) => response?.ok)).toBe(true);
});
test('a handler that outlives the deadline is answered with deadline', async () => {
	const { session } = wireSession({
			limits: { requestDeadlineMs: 20 },
			handle: () => new Promise(() => {})
		}),
		link = wireLink(session);
	await link.attach();
	expect(codeOf(await link.call('snapshot'))).toBe('deadline');
});
test('failures are answered without the raw error unless it is a declared failure', async () => {
	const handle = async (request: { method: string }) => {
		if (request.method === 'snapshot') throw new Error('ENOENT /Users/someone/private/repo');
		throw new RemoteFailure('busy');
	};
	const plain = wireLink(wireSession({ handle }).session),
		explained = wireLink(
			wireSession({ handle, explain: () => ({ code: 'failed', message: 'Explained' }) }).session
		);
	await plain.attach();
	await explained.attach();
	expect(await plain.call('snapshot')).toMatchObject({
		ok: false,
		error: { code: 'failed', message: remoteErrorMessages.failed }
	});
	expect(await plain.call('startRun', run)).toMatchObject({
		ok: false,
		error: { code: 'busy', message: remoteErrorMessages.busy }
	});
	expect(await explained.call('snapshot')).toMatchObject({ error: { message: 'Explained' } });
});
