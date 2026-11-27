// @harness-uid u_z3okqfjr2m
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { clearInterval, setInterval } from 'node:timers';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ContainerViewerGateConfig } from './ContainerViewerGateService.types';
import { bridgeScreen } from './container-viewer-gate-service/bridgeScreen';
import { sendViewerAsset } from './container-viewer-gate-service/sendViewerAsset';
import {
	refuse,
	retryViewerNavigation,
	sendPairingPage
} from './container-viewer-gate-service/viewerPages';
import {
	allowedHost,
	sameOrigin,
	viewerCookie,
	viewerToken
} from './container-viewer-gate-service/viewerRequest';

const start = '/vnc.html?autoconnect=true&reconnect=true&resize=scale&path=websockify';
const beatMs = 5000;

/** The one listener in front of a container browser. Everything but pairing needs approval. */
export class ContainerViewerGateService {
	private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
	private readonly viewers = new Map<WebSocket, string>();
	private readonly hosts: ReadonlySet<string>;
	private readonly server: Server;
	private timer?: ReturnType<typeof setInterval>;

	constructor(private readonly config: ContainerViewerGateConfig) {
		this.hosts = new Set(config.hosts.map((host) => host.toLowerCase()));
		this.server = createServer((request, response) => void this.serve(request, response));
		this.server.on('upgrade', (request, socket, head) => this.upgrade(request, socket, head));
	}

	/**
	 * Binds loopback only. On a Mac whose private network forwards to loopback, that is what makes
	 * the viewer reachable from the owner's devices and never from the local network or internet.
	 */
	async listen(port: number): Promise<number> {
		await new Promise<void>((resolve, reject) => {
			this.server.once('error', reject);
			this.server.listen(port, '127.0.0.1', resolve);
		});
		this.timer = setInterval(() => this.beat(), beatMs);
		this.beat();
		return (this.server.address() as AddressInfo).port;
	}

	async close(): Promise<void> {
		clearInterval(this.timer);
		for (const socket of this.viewers.keys()) socket.terminate();
		this.config.devices.markAttended(false);
		this.server.closeAllConnections();
		await new Promise<void>((resolve) => this.server.close(() => resolve()));
	}

	private async serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
		if (!allowedHost(request, this.hosts) || request.method !== 'GET') {
			refuse(response, 403);
			return;
		}
		const path = new URL(request.url ?? '/', 'http://viewer').pathname;
		const access = this.config.devices.access(viewerToken(request));
		if (access.status !== 'approved') this.pair(path, access, request, response);
		else if (path === '/') response.writeHead(302, { location: start }).end();
		else await sendViewerAsset(response, this.config.assets, path);
	}

	private pair(
		path: string,
		access: ReturnType<ContainerViewerGateConfig['devices']['access']>,
		request: IncomingMessage,
		response: ServerResponse
	): void {
		if (path !== '/') refuse(response, 403);
		else if (request.headers['sec-fetch-site'] === 'cross-site') {
			// A legacy Strict cookie can be present in the browser but absent from this request.
			if (request.headers['sec-fetch-dest'] === 'document') retryViewerNavigation(response);
			else refuse(response, 403);
		} else if (access.status === 'pending') sendPairingPage(response, access.code);
		else {
			const { token, code } = this.config.devices.request();
			const keep = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000';
			sendPairingPage(response, code, `${viewerCookie}=${token}; ${keep}`);
		}
	}

	private upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
		const token = viewerToken(request);
		const allowed =
			allowedHost(request, this.hosts) &&
			sameOrigin(request) &&
			request.url === '/websockify' &&
			this.config.devices.access(token).status === 'approved';
		if (!allowed || !token) {
			socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
			return;
		}
		this.sockets.handleUpgrade(request, socket, head, (viewer) => {
			this.viewers.set(viewer, token);
			viewer.once('close', () => {
				this.viewers.delete(viewer);
				this.beat();
			});
			this.beat();
			bridgeScreen(viewer, this.config.pipes.pipe('screen'));
		});
	}

	/** Also drops viewers whose approval was revoked while connected. */
	private beat(): void {
		for (const [viewer, token] of this.viewers)
			if (this.config.devices.access(token).status !== 'approved') viewer.terminate();
		this.config.devices.markAttended(this.viewers.size > 0);
	}
}
