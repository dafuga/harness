import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RelaySocketAdapter } from '../../src/adapters/networking-security/RelaySocketAdapter';
import type {
	HeaderSocket,
	SocketEvent
} from '../../src/adapters/networking-security/RelaySocketAdapter.types';
import { RelaySocketConnectionError } from '../../src/adapters/networking-security/RelaySocketAdapter.types';

class ExampleSocket implements HeaderSocket {
	static instances: ExampleSocket[] = [];
	readyState = 0;
	sent: string[] = [];
	closed: number[] = [];
	private listeners = new Map<string, Array<(event: SocketEvent) => void>>();

	constructor(
		readonly url: string,
		readonly options: { headers: Record<string, string> }
	) {
		ExampleSocket.instances.push(this);
	}

	addEventListener(type: string, listener: (event: SocketEvent) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	send(text: string) {
		this.sent.push(text);
	}

	close(code?: number) {
		this.closed.push(code ?? 1000);
	}

	fire(type: string, event: SocketEvent = {}) {
		for (const listener of this.listeners.get(type) ?? []) listener(event);
	}
}

function observeLifecycle(socket: ReturnType<RelaySocketAdapter['open']>, raw: ExampleSocket) {
	const messages: string[] = [];
	const closeCodes: number[] = [];
	socket.onMessage((message) => messages.push(message));
	socket.onClose((code) => closeCodes.push(code));
	socket.send('before-open');
	raw.readyState = 1;
	raw.fire('open');
	return socket.opened.then(() => {
		socket.send('hello relay');
		raw.fire('message', { data: 'relay-ready' });
		raw.fire('message', { data: new Uint8Array([1]) });
		socket.close();
		socket.close(4100);
		raw.fire('close', { code: 4101 });
		raw.fire('close');
		return {
			url: raw.url,
			headers: raw.options.headers,
			opened: 'resolved',
			sent: raw.sent,
			closeRequests: raw.closed,
			messages,
			closeCodes
		};
	});
}

function summarizeFailure(opened: Promise<void>) {
	return opened.then(
		() => null,
		(error: unknown) =>
			error instanceof Error
				? { name: error.name, message: error.message }
				: { name: 'UnknownError', message: String(error) }
	);
}

function exampleCases(details: {
	url: string;
	errorUrl: string;
	headers: Record<string, string>;
	output: Awaited<ReturnType<typeof observeLifecycle>>;
	failure: Awaited<ReturnType<typeof summarizeFailure>>;
}): Parameters<typeof recordExampleCases>[1] {
	return [
		{
			name: 'Default socket config forwards headers and relay lifecycle',
			input: {
				config: {},
				url: details.url,
				headers: details.headers,
				messages: ['relay-ready', { type: 'Uint8Array', bytes: [1] }],
				closeEvents: [4101, null]
			},
			output: details.output
		},
		{
			name: 'A socket error rejects the open promise',
			input: { config: {}, url: details.errorUrl, headers: details.headers, event: 'error' },
			error: details.failure
		}
	];
}

afterEach(() => {
	vi.unstubAllGlobals();
	ExampleSocket.instances = [];
});

test('Opens relay sockets with headers and forwards lifecycle', async () => {
	vi.stubGlobal('WebSocket', ExampleSocket);
	const adapter = new RelaySocketAdapter();
	const headers = { Authorization: 'Bearer example-relay-token' };
	const url = 'wss://relay.example.test/socket';
	const output = await observeLifecycle(adapter.open(url, headers), ExampleSocket.instances[0]!);
	expect(output).toEqual({
		url,
		headers,
		opened: 'resolved',
		sent: ['hello relay'],
		closeRequests: [1000, 4100],
		messages: ['relay-ready'],
		closeCodes: [4101, 1006]
	});
	const errorUrl = 'wss://relay.example.test/unavailable';
	const failedSocket = adapter.open(errorUrl, headers);
	ExampleSocket.instances[1]!.fire('error');
	const failure = await summarizeFailure(failedSocket.opened);
	expect(failure).toEqual({
		name: 'RelaySocketConnectionError',
		message: 'The relay could not be reached.'
	});
	recordExampleCases(
		{
			unitId: 'desktop.adapter.relay-socket',
			symbol: 'open',
			state: 'opens-relay-sockets-with-headers-and-forwards-lifecycle',
			evidence: 'examples-cases',
			file: 'opens-relay-sockets-with-headers-and-forwards-lifecycle.json'
		},
		exampleCases({ url, errorUrl, headers, output, failure })
	);
});

test('Throws RelaySocketConnectionError when socket emits an error', async () => {
	const adapter = new RelaySocketAdapter({ socket: ExampleSocket });
	const url = 'wss://relay.example.test/unavailable';
	const headers = { Authorization: 'Bearer example-relay-token' };
	const socket = adapter.open(url, headers);
	ExampleSocket.instances[0]!.fire('error');
	const thrown = await socket.opened.then(
		() => null,
		(error: unknown) => error
	);
	const failure = await summarizeFailure(socket.opened);
	expect(thrown).toBeInstanceOf(RelaySocketConnectionError);
	expect(failure).toEqual({
		name: 'RelaySocketConnectionError',
		message: 'The relay could not be reached.'
	});
	recordExampleCases(
		{
			unitId: 'desktop.adapter.relay-socket',
			symbol: 'open',
			state: 'throws-relaysocketconnectionerror-when-socket-emits-an-error',
			evidence: 'examples-cases',
			file: 'throws-relaysocketconnectionerror-when-socket-emits-an-error.json'
		},
		[
			{
				name: 'Socket error rejects the returned opened promise',
				input: { url, headers, event: 'error' },
				error: failure
			}
		]
	);
});
