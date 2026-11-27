// @harness-uid u_z3okqfjr2m
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { clearInterval, setInterval } from 'node:timers';
import { WebSocketServer, type WebSocket } from 'ws';
import { ContainerCdpAdapter } from '../../adapters/execution-runtimes/ContainerCdpAdapter';
import type {
	ContainerViewerGateConfig,
	ViewerConnection
} from './ContainerViewerGateService.types';
import { bridgeScreen } from './container-viewer-gate-service/bridgeScreen';
import { navigateViewer } from './container-viewer-gate-service/navigateViewer';
import { sendViewerAsset } from './container-viewer-gate-service/sendViewerAsset';
import {
	refuse,
	sendViewerControls,
	sendViewerPairing
} from './container-viewer-gate-service/viewerPages';
import { admitViewer, viewerToken } from './container-viewer-gate-service/viewerRequest';

const beatMs = 5000;

/** The one listener in front of a container browser. Everything but pairing needs approval. */
export class ContainerViewerGateService {
	private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
	private readonly viewers = new Map<WebSocket, ViewerConnection>();
	private readonly cdp: ContainerCdpAdapter;
	private readonly hosts: ReadonlySet<string>;
	private readonly server: Server;
	private timer?: ReturnType<typeof setInterval>;

	constructor(private readonly config: ContainerViewerGateConfig) {
		this.cdp = new ContainerCdpAdapter(config.pipes);
		this.hosts = new Set(config.hosts.map((host) => host.toLowerCase()));
		this.server = createServer((request, response) => {
			void this.serve(request, response).catch(() => refuse(response, 503));
		});
		this.server.on('upgrade', (request, socket, head) => {
			void this.upgrade(request, socket, head).catch(() => socket.destroy());
		});
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
		const admission = await admitViewer(request, this.config, this.hosts);
		if (!admission) return refuse(response, 403);
		const path = new URL(request.url ?? '/', 'http://viewer').pathname;
		const secure = admission.expiresAt !== undefined;
		const access = admission.devices.access(viewerToken(request, secure));
		if (request.method === 'POST' && path === '/navigate') {
			if (request.headers.origin !== admission.origin || access.status !== 'approved')
				return refuse(response, 403);
			return navigateViewer(request, response, this.cdp);
		}
		if (request.method !== 'GET') return refuse(response, 403);
		if (access.status !== 'approved') {
			if (path !== '/') return refuse(response, 403);
			return sendViewerPairing(response, admission.devices, access, secure);
		}
		if (path === '/')
			response.writeHead(302, { location: '/viewer', 'cache-control': 'no-store' }).end();
		else if (path === '/viewer') sendViewerControls(response);
		else await sendViewerAsset(response, this.config.assets, path);
	}

	private async upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
		const admission = await admitViewer(request, this.config, this.hosts);
		const token = viewerToken(request, admission?.expiresAt !== undefined);
		const allowed =
			admission &&
			request.headers.origin === admission.origin &&
			request.url === '/websockify' &&
			admission.devices.access(token).status === 'approved';
		if (!allowed || !token) {
			socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
			return;
		}
		this.sockets.handleUpgrade(request, socket, head, (viewer) => {
			this.viewers.set(viewer, { ...admission, token });
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
		for (const [viewer, { token, devices, expiresAt }] of this.viewers) {
			if (
				(expiresAt !== undefined && expiresAt <= Date.now()) ||
				devices.access(token).status !== 'approved'
			)
				viewer.terminate();
		}
		this.config.devices.markAttended(this.viewers.size > 0);
	}
}
