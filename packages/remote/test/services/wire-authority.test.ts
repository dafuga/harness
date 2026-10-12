import { expect, test } from 'vitest';
import type { RemoteAttachment, WireRequest, WireResponse } from '../../src/models/Remote.types';
import { ResponseLedgerService } from '../../src/services/ResponseLedgerService';
import { WireClientService } from '../../src/services/WireClientService';
import type { WireSessionService } from '../../src/services/WireSessionService';
import { codeOf, tick, wireLink, wireSession } from '../support/wireHarness';

const run = { projectId: 'p', text: 'go' };
const epochOf = (response: WireResponse | undefined) =>
	((response as { value?: unknown } | undefined)?.value as RemoteAttachment).epoch;
/** A wire client attached to a session in memory; `lossy` drops what the host answers. */
async function attached(session: WireSessionService, client = clientOf()) {
	const state = { lossy: false },
		sent: WireRequest[] = [];
	const link = session.connect((text) => (state.lossy ? undefined : client.receive(text)));
	const attachment = await client.bind((text) => {
		sent.push(JSON.parse(text) as WireRequest);
		void link.receive(text);
	});
	return { client, link, state, sent, attachment };
}
const clientOf = () =>
	new WireClientService({ client: { kind: 'test', name: 'fixture' }, deadlineMs: 2000 });

test('a bound session runs a mutation only when it names the current epoch; reads need none', async () => {
	const { session, calls } = wireSession({ authority: true }),
		link = wireLink(session),
		epoch = epochOf(await link.attach());
	expect(codeOf(await link.call('startRun', run))).toBe('request-expired');
	expect(codeOf(await link.call('startRun', { ...run, epoch: 'f'.repeat(32) }))).toBe(
		'request-expired'
	);
	expect(calls).toEqual([]);
	expect(await link.call('startRun', { ...run, epoch })).toMatchObject({ ok: true });
	expect(await link.call('snapshot', { projectId: 'p' })).toMatchObject({ ok: true });
	expect(calls.map((request) => request.method)).toEqual(['startRun', 'snapshot']);
});
test('the client names the epoch of its attachment in every mutation and in no read', async () => {
	const { session } = wireSession({ authority: true }),
		{ client, sent, attachment } = await attached(session);
	await client.request('startRun', run);
	await client.request('snapshot', { projectId: 'p' });
	expect(sent[1]).toMatchObject({ method: 'startRun', input: { ...run, epoch: attachment.epoch } });
	expect(sent[2].input).toEqual({ projectId: 'p' });
});
test('a mutation issued before a new epoch is never sent again: its outcome is uncertain', async () => {
	const before = wireSession({ authority: true }),
		after = wireSession({ authority: true }),
		first = await attached(before.session),
		resyncs: unknown[] = [];
	first.client.on('connection', (event) => resyncs.push(event));
	first.state.lossy = true;
	const change = first.client.request('startRun', run),
		read = first.client.request('snapshot', { projectId: 'p' });
	await expect.poll(() => before.calls.length).toBe(2);
	first.client.unbind();
	const second = await attached(after.session, first.client);
	await expect(change).rejects.toMatchObject({ code: 'request-expired' });
	expect(await read).toEqual({ echo: { projectId: 'p' } });
	expect(before.calls.map((request) => request.method).sort()).toEqual(['snapshot', 'startRun']);
	expect(after.calls.map((request) => request.method)).toEqual(['snapshot']);
	expect(second.sent.map((request) => request.method)).toEqual(['session.attach', 'snapshot']);
	expect(resyncs).toEqual([{ kind: 'resync' }]);
});
test('a host refuses a mutation of an earlier epoch even from a client that sends it again', async () => {
	const before = wireSession({ authority: true }),
		after = wireSession({ authority: true }),
		old = wireLink(before.session),
		next = wireLink(after.session),
		epoch = epochOf(await old.attach());
	await next.attach();
	expect(codeOf(await next.call('startRun', { ...run, epoch }))).toBe('request-expired');
	expect(after.calls).toEqual([]);
});
test('within one epoch a re-sent mutation is still answered from the ledger', async () => {
	const { session, calls } = wireSession({ authority: true }),
		first = await attached(session);
	first.state.lossy = true;
	const change = first.client.request('startRun', run);
	await tick();
	first.client.unbind();
	first.link.close();
	await attached(session, first.client);
	expect(await change).toEqual({ echo: { ...run, epoch: session.events.epoch } });
	expect(calls).toHaveLength(1);
});
test('an answer that is no longer kept is refused as expired, never run again', async () => {
	let now = 1,
		writes = 0;
	const ledger = new ResponseLedgerService({ capacity: 1, ttlMs: 10, now: () => now }),
		execute = async () => ++writes,
		entry = (id: string, digest = 'd') => ({ id, digest });
	await ledger.run(entry('a'), execute);
	await ledger.run(entry('b'), execute);
	await expect(ledger.run(entry('a'), execute)).rejects.toMatchObject({ code: 'request-expired' });
	now = 100;
	await expect(ledger.run(entry('b'), execute)).rejects.toMatchObject({ code: 'request-expired' });
	await expect(ledger.run(entry('b', 'other'), execute)).rejects.toMatchObject({
		code: 'request-conflict'
	});
	expect(writes).toBe(2);
	const full = new ResponseLedgerService({ tombstones: 2 });
	await full.run(entry('a'), execute);
	await full.run(entry('b'), execute);
	await expect(full.run(entry('c'), execute)).rejects.toMatchObject({ code: 'too-many-requests' });
	expect(writes).toBe(4);
});
