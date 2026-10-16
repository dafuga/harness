import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { WireFramingService, remoteLimits } from '../../remote/src/index';
import { attempt, closed, localFixture } from './local-transport-fixture';
import { git } from './run-fixture';

type Fixture = Awaited<ReturnType<typeof localFixture>>;
/** A socket of the app page with a fresh ticket of its window: what an honest preload opens. */
async function admitted(f: Fixture, target = f.window()) {
	const { socket } = await attempt(f.port, { protocols: f.ticketed(target) });
	if (!socket) throw new Error('The transport refused an honest socket.');
	return socket;
}
const framesOf = (text: string, chunkBytes?: number) => {
	const frames: string[] = [];
	new WireFramingService({
		write: (frame) => frames.push(frame),
		defer: (step) => step(),
		chunkBytes
	}).send(text);
	return frames;
};

test('a socket opens only with a fresh ticket, from the app page, on the transport path', async () => {
	const f = await localFixture(),
		window = f.window(),
		ticket = () => f.transport.bootstrap(window).ticket,
		good = () => ['harness.v1', 'ticket.' + ticket()];
	const refused: [Parameters<typeof attempt>[1], number][] = [
		[{ protocols: [] }, 401],
		[{ protocols: ['harness.v1'] }, 401],
		[{ protocols: ['ticket.' + ticket()] }, 401],
		[{ protocols: ['harness.v1', 'ticket.' + 'A'.repeat(43)] }, 401],
		[{ protocols: ['harness.v1', 'ticket.' + ticket(), 'ticket.' + ticket()] }, 401],
		[{ protocols: good(), origin: 'https://evil.example' }, 403],
		[{ protocols: good(), origin: null }, 403],
		[{ protocols: good(), path: '/v1/other' }, 403],
		[{ protocols: ['harness.v1'], path: '/v1/local?ticket=' + ticket() }, 403],
		[{ protocols: good(), host: 'evil.example' }, 403]
	];
	for (const [options, status] of refused)
		expect((await attempt(f.port, options)).status).toBe(status);
	expect(f.transport.connections).toBe(0);
	const once = good();
	expect((await attempt(f.port, { protocols: once })).status).toBe(101);
	expect((await attempt(f.port, { protocols: once })).status).toBe(401);
	expect(f.transport.connections).toBe(1);
}, 40000);

test('a ticket is short-lived, and the number of sockets is bounded', async () => {
	const clock = { now: Date.now() },
		f = await localFixture(undefined, { now: () => clock.now, clients: 1 }),
		window = f.window(),
		stale = f.ticketed(window);
	clock.now += 10001;
	expect((await attempt(f.port, { protocols: stale })).status).toBe(401);
	expect((await attempt(f.port, { protocols: f.ticketed(window) })).status).toBe(101);
	expect((await attempt(f.port, { protocols: f.ticketed(window) })).status).toBe(503);
	expect(f.transport.connections).toBe(1);
}, 40000);

test('frames that break the bounds close the socket and reach no operation', async () => {
	const f = await localFixture(),
		head = git(f.root, 'rev-parse', 'HEAD'),
		oversize = framesOf('x'.repeat(remoteLimits.requestBytes + 1)),
		starts = Array.from({ length: 9 }, (_, message) =>
			JSON.stringify({ type: 'part', message, index: 0, last: false, data: 'YQ==' })
		);
	const cases: [(string | Buffer)[], number][] = [
		[['x'.repeat(remoteLimits.frameBytes + 1)], 1009],
		[['not json'], 4400],
		[[Buffer.from([1, 2, 3])], 1003],
		[oversize, 4413],
		[starts, 4429],
		[[starts[0], starts[0]], 4400]
	];
	for (const [frames, code] of cases) {
		const socket = await admitted(f),
			answers: string[] = [];
		socket.on('message', (data) => answers.push(data.toString()));
		for (const frame of frames) socket.send(frame);
		expect(await closed(socket)).toBe(code);
		expect(answers).toEqual([]);
	}
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(head);
	expect(f.control.calls).toEqual([]);
}, 40000);

test('a request that never completes is never performed', async () => {
	const f = await localFixture(),
		window = f.window(),
		head = git(f.root, 'rev-parse', 'HEAD'),
		socket = await admitted(f, window),
		id = crypto.randomUUID(),
		attach = { protocol: 1, client: { kind: 'electron', name: 'fixture' }, resume: null },
		answers: string[] = [];
	socket.on('message', (data) => answers.push(data.toString()));
	socket.send(
		framesOf(JSON.stringify({ type: 'request', id, method: 'session.attach', input: attach }))[0]
	);
	await expect.poll(() => answers.length).toBe(1);
	const change = { type: 'request', id: crypto.randomUUID(), method: 'remote.enable', input: {} },
		[first, second] = framesOf(JSON.stringify(change), 40).map((frame) =>
			frame.replace('"message":0', '"message":1')
		);
	socket.send(first);
	await new Promise((resolve) => setTimeout(resolve, 50));
	expect(second).toBeDefined();
	socket.close();
	await closed(socket);
	expect(answers).toHaveLength(1);
	expect(f.control.calls).toEqual([]);
	expect(git(f.root, 'rev-parse', 'HEAD')).toBe(head);
	expect(window.ended).toBe(false);
}, 40000);
