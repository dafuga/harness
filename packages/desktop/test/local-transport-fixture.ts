import { afterEach } from 'vitest';
import { randomFillSync } from 'node:crypto';
import { PNG } from 'pngjs';
import { WebSocket as SocketClient } from 'ws';
import type { RemoteHostStatus } from '../../remote/src/index';
import type { AgentTurn } from '../src/models/AgentRunner.types';
import { CommentOutboxService } from '../src/services/CommentOutboxService';
import { LocalClientService } from '../src/services/LocalClientService';
import type { LocalClientOptions } from '../src/services/LocalClientService';
import type { LocalControl } from '../src/services/LocalOperationsService';
import { LocalTransportClientService } from '../src/services/LocalTransportClientService';
import type { LocalSocketPort } from '../src/services/LocalTransportClientService';
import { LocalTransportService } from '../src/services/LocalTransportService';
import type { LocalTransportOptions } from '../src/services/LocalTransportService';
import { remoteFixture } from './remote-fixture';

const closing: (() => unknown)[] = [];
afterEach(async () => {
	await Promise.all(closing.splice(0).map((close) => close()));
});
export const appOrigin = 'harness://app';
/** A PNG of noise: deflate cannot shrink it, so it is well over a mebibyte. */
export function largeImage(): Uint8Array {
	const png = new PNG({ width: 640, height: 640 });
	randomFillSync(png.data);
	return PNG.sync.write(png);
}
/** The control port of remote access, recording what reached it. */
export function fakeControl() {
	const calls: [string, unknown][] = [];
	const status = { supported: true, enabled: false, state: 'disabled' } as RemoteHostStatus;
	const names = [
		'status',
		'enable',
		'disable',
		'createPairing',
		'approvePairing',
		'denyPairing',
		'revokeDevice'
	];
	const answer = (name: string) => async (input?: unknown) => {
		calls.push([name, input]);
		return status;
	};
	const port = Object.fromEntries(names.map((name) => [name, answer(name)]));
	return { calls, status, port: port as unknown as LocalControl };
}
export interface Attempt {
	protocols?: string[];
	origin?: string | null;
	path?: string;
	host?: string;
}
/** One WebSocket handshake against the transport: 101 with the socket, or the refusal status. */
export function attempt(port: number, options: Attempt = {}) {
	const { protocols = [], origin = appOrigin, path = '/v1/local', host } = options;
	return new Promise<{ status: number; socket: SocketClient | null }>((resolve) => {
		const socket = new SocketClient(`ws://127.0.0.1:${port}${path}`, protocols, {
			...(origin === null ? {} : { origin }),
			...(host ? { headers: { host } } : {})
		});
		closing.push(() => socket.terminate());
		socket.on('open', () => resolve({ status: 101, socket }));
		socket.on('unexpected-response', (_request, response) =>
			resolve({ status: response.statusCode ?? 0, socket: null })
		);
		socket.on('error', () => resolve({ status: 0, socket: null }));
	});
}
export const closed = (socket: SocketClient) =>
	new Promise<number>((resolve) => socket.on('close', (code) => resolve(code)));

/** A computer with one project, the loopback transport, and windows that connect as the app does. */
export async function localFixture(
	action: (turn: AgentTurn) => Promise<void> = async () => {},
	options: LocalTransportOptions = {}
) {
	const f = await remoteFixture(action),
		transport = new LocalTransportService(options),
		port = await transport.listen(),
		control = fakeControl(),
		frames: string[] = [];
	closing.push(() => transport.close());
	const { registry, arbiter, providers, generator } = f,
		shared = { registry, arbiter, providers, generator, outbox: new CommentOutboxService() };
	/** What the main process keeps for one window. */
	function window(extra: Partial<LocalClientOptions> = {}) {
		const base = { shared, choose: async () => f.root, control: control.port };
		const client = new LocalClientService({ ...base, ...extra });
		closing.push(() => client.end());
		return client;
	}
	const open = (url: string, protocols: string[]) => {
		const socket = new SocketClient(url, protocols, { origin: appOrigin });
		socket.on('message', (data) => frames.push(data.toString()));
		closing.push(() => socket.terminate());
		return socket as unknown as LocalSocketPort;
	};
	/** What the preload of that window does: a ticket over IPC, then the socket. */
	function connect(target: LocalClientService) {
		const bootstrap = async () => transport.bootstrap(target);
		const client = new LocalTransportClientService({ bootstrap, open, retryMs: [20] });
		closing.push(() => client.close());
		return client;
	}
	const ticketed = (target: LocalClientService) => [
		'harness.v1',
		'ticket.' + transport.bootstrap(target).ticket
	];
	return { ...f, transport, port, control, frames, window, connect, ticketed };
}
