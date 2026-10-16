import { expect } from '../../../test/verificationExpect';
import { afterAll, test, vi } from 'vitest';
import { once } from 'node:events';
import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { localFixture, settle } from './local-transport-fixture';

const unreachable = 'The desktop backend cannot be reached.';
const refusal =
	'HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\nContent-Length: 0\r\n\r\n';

/**
 * HANDSHAKE BARRIER. It listens where the transport would, on a port of this machine that the
 * system picks, takes the upgrade request of a WebSocket and gives no answer: the socket that
 * asked stays CONNECTING until its owner cancels it. It ends no connection itself, so a socket
 * that nobody closed is seen here as a connection that is still held.
 */
class HandshakeBarrier {
	/** What a connection raised here; an owner that cancels its socket raises nothing. */
	readonly faults: string[] = [];
	private readonly held = new Set<Socket>();
	private readonly heads: string[] = [];
	private readonly waiting: ((head: string) => void)[] = [];
	private readonly server = createServer((socket) => this.hold(socket));
	private refusing = false;
	get connected(): number {
		return this.held.size;
	}
	get listening(): boolean {
		return this.server.listening;
	}
	async listen(): Promise<number> {
		this.server.listen(0, '127.0.0.1');
		await once(this.server, 'listening');
		return (this.server.address() as AddressInfo).port;
	}
	bootstrap() {
		return { port: (this.server.address() as AddressInfo).port, ticket: 'barrier' };
	}
	/** The next handshake is answered, with a refusal no test asked for. */
	refuse(): void {
		this.refusing = true;
	}
	/** The head of the next handshake that reached the barrier. */
	handshake(): Promise<string> {
		const head = this.heads.shift();
		if (head !== undefined) return Promise.resolve(head);
		return new Promise((resolve) => this.waiting.push(resolve));
	}
	/** Listens no more. The connections it holds are their owners' to end. */
	close(): void {
		if (this.server.listening) this.server.close();
	}
	/** Resolves when no connection is held any more. */
	async emptied(): Promise<void> {
		for (const socket of [...this.held]) if (!socket.destroyed) await once(socket, 'close');
	}
	/** Ends what a failed test left behind, so that nothing of this file outlives it. */
	drop(): void {
		for (const socket of this.held) socket.destroy();
	}
	private hold(socket: Socket): void {
		let head = '';
		this.held.add(socket);
		socket.on('error', (error) => this.faults.push(error.message));
		socket.on('close', () => this.held.delete(socket));
		socket.on('data', (data) => {
			head += data.toString('latin1');
			if (!head.endsWith('\r\n\r\n')) return;
			if (this.refusing) socket.end(refusal);
			this.refusing = false;
			const next = this.waiting.shift();
			if (next) next(head);
			else this.heads.push(head);
		});
	}
}
vi.mock('../src/services/LocalTransportService', () => ({
	LocalTransportService: function () {
		return new HandshakeBarrier();
	}
}));

let barrier: HandshakeBarrier | null = null;
let answer: Promise<string> = Promise.resolve('never asked');
afterAll(() => barrier?.drop());
/** A window's page asks through the fixture's own socket, at a barrier in place of the transport. */
async function asking() {
	const f = await localFixture();
	const held = f.transport as unknown as HandshakeBarrier;
	const asked = f.connect(f.window()).request('listProjects');
	return {
		f,
		held,
		answer: asked.then(
			() => 'answered',
			(error: Error) => error.message
		)
	};
}
/** What came of a request, or that nothing has come of it so far. It waits for nothing. */
const outcome = (asked: Promise<string>) => Promise.race([asked, Promise.resolve('not told')]);

test('a page socket whose handshake is never answered is still connecting when its test ends', async () => {
	const page = await asking();
	[barrier, answer] = [page.held, page.answer];
	const head = await page.held.handshake();
	expect(head.split('\r\n')[0]).toBe('GET /v1/local HTTP/1.1');
	expect(head.toLowerCase()).toContain('upgrade: websocket');
	expect([page.held.connected, page.held.listening]).toEqual([1, true]);
	expect(await outcome(page.answer)).toBe('not told');
}, 40000);

test('the teardown of that test cancelled the socket and told its page that the backend is gone', async () => {
	await barrier?.emptied();
	expect(await outcome(answer)).toBe(unreachable);
	expect([barrier?.connected, barrier?.listening, barrier?.faults]).toEqual([0, false, []]);
}, 40000);

const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
type Page = Awaited<ReturnType<typeof asking>>;
const sockets = (page: Page) => page.f.sockets.map((socket) => states[socket.readyState]);

test('the teardown returns only once the socket it cancelled has closed', async () => {
	const page = await asking();
	try {
		await page.held.handshake();
		expect(sockets(page)).toEqual(['CONNECTING']);
		await settle();
		expect(sockets(page)).toEqual(['CLOSED']);
		expect(await page.answer).toBe(unreachable);
		await page.held.emptied();
		expect([page.held.connected, page.held.listening, page.held.faults]).toEqual([0, false, []]);
	} finally {
		page.held.drop();
	}
}, 40000);

test('an error the teardown did not cause is thrown by it, once the socket has closed', async () => {
	const page = await asking();
	try {
		page.held.refuse();
		expect(await page.answer).toBe(unreachable);
		await page.held.emptied();
		expect(sockets(page)).toEqual(['CLOSED']);
		await expect(settle()).rejects.toThrow('Unexpected server response: 500');
		expect([page.held.connected, page.held.listening, page.held.faults]).toEqual([0, false, []]);
	} finally {
		page.held.drop();
	}
}, 40000);

test('the same error raised before the teardown is not its doing, and is thrown as well', async () => {
	const page = await asking();
	try {
		await page.held.handshake();
		page.f.sockets[0].close();
		expect(await page.answer).toBe(unreachable);
		await expect(settle()).rejects.toThrow('closed before the connection was established');
		expect(sockets(page)).toEqual(['CLOSED']);
		await page.held.emptied();
		expect([page.held.connected, page.held.listening, page.held.faults]).toEqual([0, false, []]);
	} finally {
		page.held.drop();
	}
}, 40000);
