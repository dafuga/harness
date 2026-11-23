// @harness-uid u_xadic2nwwc
import { execFileSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, rmdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { dirname } from 'node:path';
import type { Duplex } from 'node:stream';
import { clearInterval, setInterval } from 'node:timers';
import { WebSocket, WebSocketServer } from 'ws';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { maxCdpFrameBytes } from './vault-cdp-relay-adapter/VaultCdpPipe';
import type { VaultCdpRelayAdapterConfig } from './VaultCdpRelayAdapter.types';

/** Connects one active lease to an existing private Chromium pipe. */
export class VaultCdpRelayAdapter {
	private readonly ws = new WebSocketServer({ noServer: true, maxPayload: maxCdpFrameBytes });
	private readonly path: string;
	private readonly server: Server;
	private readonly peers = new Set<Duplex>();
	private active: WebSocket | null = null;
	private ownsDirectory = false;
	private timer?: ReturnType<typeof setInterval>;
	private release?: () => void;
	private closing?: Promise<void>;

	constructor(private readonly config: VaultCdpRelayAdapterConfig) {
		this.path = config.keeper.relaySocketPath(config.lease);
		if (Buffer.byteLength(this.path) > 103)
			throw new ExpectedCliError('Vault CDP socket path is too long.');
		this.server = createServer((_request, response) => response.writeHead(404).end());
		this.server.on('upgrade', (request, socket, head) => this.upgrade(request, socket, head));
		this.server.on('connection', (socket) => trackPeer(this.peers, socket));
	}

	async listen(): Promise<void> {
		const directory = dirname(this.path);
		const uid = this.config.keeper.relaySessionUid(this.config.lease);
		const crossUser = uid !== process.getuid?.();
		requireRunDirectory(dirname(directory), crossUser);
		mkdirSync(directory, { mode: 0o700 });
		this.ownsDirectory = true;
		try {
			await new Promise<void>((resolve, reject) => {
				this.server.once('error', reject);
				this.server.listen(this.path, resolve);
			});
			chmodSync(this.path, 0o600);
			if (crossUser) grantSessionAccess(this.path, uid);
			this.startReading();
		} catch (error) {
			await this.close();
			throw error;
		}
	}

	close(): Promise<void> {
		return (this.closing ??= this.stop());
	}

	private startReading(): void {
		const { pipe, keeper, lease } = this.config;
		this.release = pipe.listen({ message: this.forward, close: this.failed });
		this.timer = setInterval(() => {
			if (!keeper.relayEvent(lease, 'tick')) this.failed();
		}, 250);
		this.timer.unref();
	}

	private async stop(): Promise<void> {
		clearInterval(this.timer);
		this.release?.();
		this.active?.terminate();
		for (const peer of this.peers) peer.destroy();
		await new Promise<void>((resolve) => this.server.close(() => resolve()));
		if (this.ownsDirectory) rmdirSync(dirname(this.path));
	}

	private upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
		const { keeper, lease, peerUid } = this.config;
		const auth = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/u);
		const rightPath = request.url === '/devtools/browser' && request.method === 'GET';
		if (
			this.active ||
			!auth ||
			!rightPath ||
			!keeper.admit(lease, peerUid(socket), auth[1]).allowed
		) {
			socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
			return;
		}
		this.ws.handleUpgrade(request, socket, head, (connection) => this.bind(connection));
	}

	private bind(socket: WebSocket): void {
		const { keeper, lease } = this.config;
		if (!keeper.relayEvent(lease, 'connect')) {
			socket.terminate();
			return;
		}
		this.active = socket;
		socket.on('error', () => socket.terminate());
		socket.on('message', (data, binary) => {
			const alive = keeper.relayEvent(lease, 'activity');
			if (!alive || binary || !this.config.pipe.send(data.toString())) socket.terminate();
		});
		socket.once('close', () => {
			this.active = null;
			this.config.pipe.detach();
			keeper.relayEvent(lease, 'disconnect');
		});
	}

	private readonly failed = (): void => {
		void this.close().catch(() => undefined);
	};

	private readonly forward = (text: string): void => {
		if (!this.config.keeper.relayEvent(this.config.lease, 'tick')) {
			this.failed();
			return;
		}
		if (this.active?.readyState !== WebSocket.OPEN) return;
		if (this.active.bufferedAmount > maxCdpFrameBytes) this.active.terminate();
		else this.active.send(text);
	};
}

function requireRunDirectory(path: string, crossUser: boolean): void {
	if (!crossUser) mkdirSync(path, { recursive: true, mode: 0o700 });
	const parent = lstatSync(path, { throwIfNoEntry: false });
	const mode = crossUser ? 0o711 : 0o700;
	if (
		parent?.isDirectory() &&
		parent.uid === process.getuid?.() &&
		(parent.mode & 0o7777) === mode
	) {
		return;
	}
	const requirement = crossUser
		? 'a searchable runtime directory (0711)'
		: 'a private run directory';
	throw new ExpectedCliError(`CDP relay needs ${requirement} owned by the executor.`);
}

function grantSessionAccess(path: string, uid: number): void {
	if (process.platform !== 'darwin') {
		throw new ExpectedCliError('Cross-user CDP ACLs require macOS.');
	}
	const user = execFileSync('/usr/bin/id', ['-un', String(uid)], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	}).trim();
	if (!/^[a-zA-Z_][\w.-]*$/u.test(user)) {
		throw new ExpectedCliError('Could not resolve the CDP requester to a local ACL identity.');
	}
	const principal = `user:${user} allow `;
	execFileSync('/bin/chmod', ['+a', principal + 'write', path], { stdio: 'ignore' });
	execFileSync('/bin/chmod', ['+a', principal + 'search', dirname(path)], { stdio: 'ignore' });
}

function trackPeer(peers: Set<Duplex>, socket: Duplex): void {
	peers.add(socket);
	socket.once('close', () => peers.delete(socket));
}
