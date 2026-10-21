import { expect, test } from 'vitest';
import type { RelayHostFrame } from '../../../remote/src/index';
import type { RemoteSocket } from '../../../remote/src/index';
import { RelayLinkService } from '../../src/services/relay-link-service/RelayLinkService';
import type { RelayLinkOptions } from '../../src/services/relay-link-service/RelayLinkService';

const hostId = 'a'.repeat(40),
	deviceId = 'd'.repeat(40),
	connectionId = 'c'.repeat(32),
	pause = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function controlled() {
	let message: ((text: string) => void) | null = null,
		closed: ((code: number) => void) | null = null,
		accept!: () => void,
		refuse!: (error: Error) => void;
	const sent: string[] = [],
		closes: number[] = [];
	const socket: RemoteSocket = {
		opened: new Promise<void>((resolve, reject) => {
			accept = resolve;
			refuse = reject;
		}),
		send: (text) => sent.push(text),
		close: (code = 1000) => closes.push(code),
		onMessage: (listener) => (message = listener),
		onClose: (listener) => (closed = listener)
	};
	return {
		socket,
		sent,
		closes,
		accept,
		refuse: () => refuse(new Error('refused')),
		deliver: (value: unknown) =>
			message?.(typeof value === 'string' ? value : JSON.stringify(value)),
		drop: (code = 1006) => closed?.(code)
	};
}
function setup(overrides: Partial<RelayLinkOptions> = {}) {
	const opened: (ReturnType<typeof controlled> & {
			url: string;
			headers: Record<string, string>;
		})[] = [],
		frames: RelayHostFrame[] = [],
		states: string[] = [];
	const link = new RelayLinkService({
		origin: 'https://relay.example',
		hostId,
		credential: 'host-credential',
		open: (url, headers) => {
			const next = { ...controlled(), url, headers };
			opened.push(next);
			return next.socket;
		},
		onFrame: (frame) => frames.push(frame),
		onState: (state) => states.push(state),
		retryMs: [5],
		...overrides
	});
	async function online() {
		link.start();
		opened.at(-1)!.accept();
		await pause();
		return opened.at(-1)!;
	}
	return { link, opened, frames, states, online };
}

test('the host authenticates by header and is online once the socket opens', async () => {
	const f = setup();
	f.link.start();
	expect(f.opened[0].url).toBe(`wss://relay.example/v1/hosts/${hostId}/connect`);
	expect(f.opened[0].headers).toEqual({
		Authorization: 'Bearer host-credential',
		'X-Harness-Role': 'host'
	});
	expect(f.states).toEqual(['connecting']);
	f.opened[0].accept();
	await pause();
	expect(f.states).toEqual(['connecting', 'online']);
	f.link.start();
	expect(f.opened).toHaveLength(1);
	f.link.stop();
});
test('frames reach the owner; malformed ones and pongs do not', async () => {
	const f = setup(),
		socket = await f.online(),
		frame = { type: 'device-open', deviceId, connectionId };
	socket.deliver(frame);
	for (const junk of ['not json', { type: 'shell' }, 'pong']) socket.deliver(junk);
	expect(f.frames).toEqual([frame]);
	f.link.stop();
});
test('a command gets a ref and settles with its ack', async () => {
	const f = setup(),
		socket = await f.online(),
		open = {
			type: 'pairing-open',
			pairingId: 'b'.repeat(32),
			expiresAt: '2026-10-12T10:05:00.000Z'
		} as const;
	const accepted = f.link.command(open),
		first = JSON.parse(socket.sent[0]) as { ref: string };
	expect(JSON.parse(socket.sent[0])).toMatchObject(open);
	socket.deliver({ type: 'ack', ref: first.ref, ok: true });
	await expect(accepted).resolves.toBeUndefined();
	const refused = f.link.command(open),
		second = JSON.parse(socket.sent[1]) as { ref: string };
	expect(second.ref).not.toBe(first.ref);
	socket.deliver({ type: 'ack', ref: second.ref, ok: false, error: 'not-found' });
	await expect(refused).rejects.toThrow('not-found');
	expect(f.frames).toEqual([]);
	f.link.stop();
	await expect(f.link.command(open)).rejects.toThrow();
});
test('a lost socket is offline at once, fails what waits, and reconnects until stopped', async () => {
	const f = setup(),
		socket = await f.online(),
		waiting = f.link.command({ type: 'device-revoke', deviceId });
	socket.drop();
	expect(f.states.at(-1)).toBe('offline');
	expect(f.link.send({ type: 'device-drop', deviceId, connectionId, code: 4400 })).toBe(false);
	await expect(waiting).rejects.toThrow();
	await pause(30);
	expect(f.opened).toHaveLength(2);
	expect(f.states.at(-1)).toBe('connecting');
	f.opened[1].refuse();
	await pause(30);
	expect(f.opened).toHaveLength(3);
	f.link.stop();
	await pause(30);
	expect(f.opened).toHaveLength(3);
	expect(f.states.at(-1)).toBe('offline');
});
test('silence beyond the idle bound closes the socket; a heard relay keeps it', async () => {
	const quiet = setup({ pingMs: 5, idleMs: 12 }),
		silent = await quiet.online();
	await pause(50);
	expect(silent.sent).toContain('ping');
	expect(silent.closes).toEqual([4408]);
	expect(quiet.states).toContain('offline');
	quiet.link.stop();
	const alive = setup({ pingMs: 5, idleMs: 12 }),
		answering = await alive.online(),
		pongs = setInterval(() => answering.deliver('pong'), 4);
	await pause(50);
	clearInterval(pongs);
	expect(answering.closes).toEqual([]);
	expect(alive.states.at(-1)).toBe('online');
	alive.link.stop();
});
