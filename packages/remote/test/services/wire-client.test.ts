import { expect, test } from 'vitest';
import { remoteLimits } from '../../src/models/Remote.types';
import type { RemoteAttachment, WireRequest } from '../../src/models/Remote.types';
import { WireClientService } from '../../src/services/WireClientService';
import { remotePatterns } from '../../src/utils/remoteIdentity';

const epoch = 'e'.repeat(32);
function peer(deadlineMs = 500) {
	const client = new WireClientService({ client: { kind: 'test', name: 'fixture' }, deadlineMs });
	const attachment = (extra: Partial<RemoteAttachment> = {}): RemoteAttachment => ({
		protocol: 1,
		role: 'device',
		epoch,
		sequence: 0,
		replay: 'none',
		host: { id: 'a'.repeat(40), name: 'Fixture Mac', platform: 'darwin' },
		device: null,
		grant: null,
		methods: ['session.attach', 'snapshot', 'startRun'],
		limits: remoteLimits,
		...extra
	});
	const answer = (request: WireRequest, value: unknown) =>
		client.receive(JSON.stringify({ type: 'response', id: request.id, ok: true, value }));
	const event = (sequence: number, value: unknown, channel = 'run') =>
		client.receive(JSON.stringify({ type: 'event', channel, sequence, value }));
	async function bind(extra: Partial<RemoteAttachment> = {}) {
		const out: WireRequest[] = [],
			bound = client.bind((text) => out.push(JSON.parse(text) as WireRequest));
		answer(out[0], attachment(extra));
		return { out, attachment: await bound };
	}
	return { client, answer, event, bind };
}

test('bind attaches first with no resume point, then requests resolve by id', async () => {
	const p = peer(),
		{ out, attachment } = await p.bind();
	expect(out[0]).toMatchObject({
		type: 'request',
		method: 'session.attach',
		input: { protocol: 1, client: { kind: 'test', name: 'fixture' }, resume: null }
	});
	expect(attachment.role).toBe('device');
	expect(p.client.attachment).toEqual(attachment);
	const pending = p.client.request('snapshot', { projectId: 'x' });
	expect(out[1]).toMatchObject({ type: 'request', method: 'snapshot', input: { projectId: 'x' } });
	expect(out[1].id).toMatch(remotePatterns.requestId);
	p.answer(out[1], { ok: 1 });
	expect(await pending).toEqual({ ok: 1 });
});
test('a refusal rejects with its code and words', async () => {
	const p = peer(),
		{ out } = await p.bind(),
		pending = p.client.request('startRun', {});
	p.client.receive(
		JSON.stringify({
			type: 'response',
			id: out[1].id,
			ok: false,
			error: { code: 'busy', message: 'Busy' }
		})
	);
	await expect(pending).rejects.toMatchObject({ code: 'busy', message: 'Busy' });
});
test('events reach listeners once, in order, and duplicates are ignored', async () => {
	const p = peer(),
		seen: unknown[] = [],
		cache: unknown[] = [];
	await p.bind();
	const off = p.client.on('run', (value) => seen.push(value));
	p.client.on('cache', (value) => cache.push(value));
	p.event(1, 'a');
	p.event(2, 'b');
	p.event(2, 'b');
	p.event(1, 'a');
	off();
	p.event(3, 'c');
	expect(seen).toEqual(['a', 'b']);
	expect(cache).toEqual([]);
});
test('a reconnect sends the resume point and re-sends unanswered requests with their ids', async () => {
	const p = peer(),
		first = await p.bind();
	p.event(1, 'a');
	p.event(2, 'b');
	const pending = p.client.request('startRun', { text: 'go' }),
		original = first.out[1];
	p.client.unbind();
	const second = await p.bind({ sequence: 2, replay: 'resumed' });
	expect(second.out[0]).toMatchObject({
		method: 'session.attach',
		input: { resume: { epoch, sequence: 2 } }
	});
	expect(second.out[1]).toEqual(original);
	p.answer(second.out[1], { runId: 'r1' });
	expect(await pending).toEqual({ runId: 'r1' });
});
test('a gap tells listeners to resynchronise and adopts the new epoch', async () => {
	const p = peer(),
		seen: unknown[] = [],
		runs: unknown[] = [];
	await p.bind();
	p.client.on('connection', (value) => seen.push(value));
	p.client.on('run', (value) => runs.push(value));
	p.event(1, 'a');
	p.client.unbind();
	const next = await p.bind({ epoch: 'f'.repeat(32), sequence: 9, replay: 'gap' });
	expect(next.out[0]).toMatchObject({ input: { resume: { epoch, sequence: 1 } } });
	expect(seen).toEqual([{ kind: 'resync' }]);
	p.event(9, 'old');
	p.event(10, 'new');
	expect(runs).toEqual(['a', 'new']);
});
test('nothing is queued while offline and close rejects what is waiting', async () => {
	const p = peer();
	await expect(p.client.request('snapshot')).rejects.toMatchObject({ code: 'offline' });
	await p.bind();
	const pending = p.client.request('snapshot');
	p.client.close();
	await expect(pending).rejects.toMatchObject({ code: 'offline' });
	await expect(p.client.request('snapshot')).rejects.toMatchObject({ code: 'offline' });
});
test('a request without an answer ends with deadline, never success', async () => {
	const p = peer(20);
	await p.bind();
	await expect(p.client.request('snapshot')).rejects.toMatchObject({ code: 'deadline' });
});
test('frames that are not responses or events are ignored', async () => {
	const p = peer(),
		seen: unknown[] = [];
	await p.bind();
	p.client.on('run', (value) => seen.push(value));
	for (const text of ['not json', '{"type":"request"}', '[]']) p.client.receive(text);
	p.event(1, 'a');
	expect(seen).toEqual(['a']);
});
