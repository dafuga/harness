import type { Attempt } from './local-transport-fixture.types';
import { afterEach } from 'vitest';
import { randomFillSync } from 'node:crypto';
import { PNG } from 'pngjs';
import { exampleDocument } from '../../game/src/utils/game-authoring/keyDoor';
import type { GameDocument } from '../../game/src/models/game-authoring/Game.types';
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
import { git } from './run-fixture';

const closing: (() => unknown)[] = [];
/**
 * Ends what the tests opened and waits for all of it. What any of it raised that the teardown
 * did not cause is thrown here, once everything has ended.
 */
export async function settle(): Promise<void> {
	const ended = await Promise.allSettled(closing.splice(0).map(async (close) => close()));
	const raised = ended.flatMap((item) => (item.status === 'rejected' ? [item.reason] : []));
	if (raised.length === 1) throw raised[0];
	if (raised.length) throw new AggregateError(raised, 'Several things failed to end.');
}
afterEach(settle);
/** What `ws` raises of a socket that is ended before its handshake was answered. */
const cancelled = 'WebSocket was closed before the connection was established';
/**
 * A socket a test opened is ended by the teardown, which waits until it has closed. Ended while
 * it is still connecting, it raises that it was closed early: that one error is the teardown's
 * own doing. Any other error, before the teardown or during it, is thrown by the teardown.
 */
function owned(socket: SocketClient): void {
	const raised: Error[] = [],
		gone = closed(socket);
	let cancelling = false;
	socket.on('error', (error: Error) => {
		if (cancelling && error.message === cancelled) cancelling = false;
		else raised.push(error);
	});
	closing.push(async () => {
		cancelling = socket.readyState === SocketClient.CONNECTING;
		socket.terminate();
		await gone;
		if (raised.length) throw raised[0];
	});
}
export const appOrigin = 'harness://app';
/** A PNG of noise: deflate cannot shrink it, so it is well over a mebibyte. */
export function largeImage(): Uint8Array {
	const png = new PNG({ width: 640, height: 640 });
	randomFillSync(png.data);
	return PNG.sync.write(png);
}
/** A committed design image of more than a mebibyte, and the query that reads it. */
export async function committed(f: Awaited<ReturnType<typeof localFixture>>) {
	const bytes = largeImage(),
		entityId = f.request.entityId;
	const design = await f.planning.addDesign({
		entityId,
		prompt: 'Large fixture image',
		generator: { provider: 'codex', model: 'selected' },
		baseRevision: git(f.root, 'rev-parse', 'HEAD'),
		state: 'default',
		viewport: 'desktop',
		bytes
	});
	const commit = git(f.root, 'rev-parse', 'HEAD'),
		{ sha256 } = design.images[0];
	return { bytes, query: { entityId, commit, version: design.version, sha256 } };
}
/** A valid game just under its 1 MiB file cap: two views of 117 long checkpoints each. */
export function largeGame(): GameDocument {
	const document = exampleDocument(),
		[view] = document.views,
		[first] = view.checkpoints;
	view.checkpoints = Array.from({ length: 117 }, (_, index) => ({
		...first,
		id: 'step-' + index,
		requires: [],
		description: String(index).padEnd(4000, ' authored guidance')
	}));
	document.views.push({ ...view, id: 'cellar', title: 'The cellar' });
	return document;
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
/** One WebSocket handshake against the transport: 101 with the socket, or the refusal status. */
export function attempt(port: number, options: Attempt = {}) {
	const { protocols = [], origin = appOrigin, path = '/v1/local', host } = options;
	return new Promise<{ status: number; socket: SocketClient | null }>((resolve) => {
		const socket = new SocketClient(`ws://127.0.0.1:${port}${path}`, protocols, {
			...(origin === null ? {} : { origin }),
			...(host ? { headers: { host } } : {})
		});
		const gone = closed(socket);
		closing.push(async () => {
			socket.terminate();
			await gone;
		});
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
		frames: string[] = [],
		sockets: SocketClient[] = [];
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
		owned(socket);
		sockets.push(socket);
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
	return { ...f, transport, port, control, frames, sockets, window, connect, ticketed };
}

export type { Attempt } from './local-transport-fixture.types';
