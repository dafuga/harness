import { expect, test } from 'vitest';
import { RelaySocketAdapter } from '../../src/adapters/RelaySocketAdapter';

type Listener = (event: { data?: unknown; code?: number }) => void;
class FakeSocket {
	static last: FakeSocket;
	readyState = 0;
	sent: string[] = [];
	closed: number[] = [];
	private listeners = new Map<string, Listener[]>();
	constructor(
		readonly url: string,
		readonly options: { headers: Record<string, string> }
	) {
		FakeSocket.last = this;
	}
	addEventListener(type: string, listener: Listener) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}
	send(text: string) {
		this.sent.push(text);
	}
	close(code: number) {
		this.closed.push(code);
	}
	fire(type: string, event: { data?: unknown; code?: number } = {}) {
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}
}
const headers = { Authorization: 'Bearer credential', 'X-Harness-Role': 'host' };
const adapter = new RelaySocketAdapter({ socket: FakeSocket as never });

test('the credential travels in a request header, and text frames pass both ways', async () => {
	const socket = adapter.open('wss://relay.example/v1/hosts/x/connect', headers),
		raw = FakeSocket.last,
		seen: string[] = [],
		closes: number[] = [];
	expect(raw.url).toBe('wss://relay.example/v1/hosts/x/connect');
	expect(raw.options).toEqual({ headers });
	socket.onMessage((text) => seen.push(text));
	socket.onClose((code) => closes.push(code));
	socket.send('early');
	raw.readyState = 1;
	raw.fire('open');
	await socket.opened;
	socket.send('hello');
	raw.fire('message', { data: 'text frame' });
	raw.fire('message', { data: new ArrayBuffer(4) });
	socket.close(4400);
	raw.fire('close', { code: 4401 });
	expect(raw.sent).toEqual(['hello']);
	expect(seen).toEqual(['text frame']);
	expect(raw.closed).toEqual([4400]);
	expect(closes).toEqual([4401]);
});
test('a socket that fails before it opens rejects, without an unhandled error', async () => {
	const socket = adapter.open('wss://relay.example/v1/hosts/x/connect', headers);
	FakeSocket.last.fire('error');
	await expect(socket.opened).rejects.toThrow('relay');
});
