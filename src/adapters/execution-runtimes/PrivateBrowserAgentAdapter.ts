// @harness-uid u_2gqbg52t3o
import { once } from 'node:events';
import { chmodSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { isAbsolute } from 'node:path';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { PrivateBrowserAgentAdapterConfig } from './PrivateBrowserAgentAdapter.types';

/** Executor-owned Unix API for reviewed agent operations. It never exposes a browser stream. */
export class PrivateBrowserAgentAdapter {
	private readonly server: Server;

	constructor(private readonly config: PrivateBrowserAgentAdapterConfig) {
		this.server = createServer(
			{ maxHeaderSize: 4096, requestTimeout: 5000, headersTimeout: 5000 },
			(request, response) => void this.handle(request, response)
		);
		this.server.on('upgrade', (_request, socket) => socket.destroy());
		this.server.on('connect', (_request, socket) => socket.destroy());
	}

	async listen(): Promise<void> {
		const { agentUid, socketPath } = this.config;
		if (!isAbsolute(socketPath) || Buffer.byteLength(socketPath) > 103) {
			throw new ExpectedCliError('Private browser requires a short, absolute Unix socket path.');
		}
		if (!Number.isSafeInteger(agentUid) || agentUid <= 0 || agentUid === process.getuid?.()) {
			throw new ExpectedCliError('Private browser requires a distinct, non-root agent UID.');
		}
		const listening = once(this.server, 'listening');
		this.server.listen(socketPath);
		await listening;
		try {
			chmodSync(socketPath, 0o660);
		} catch {
			await this.close();
			throw new ExpectedCliError('Could not restrict the private browser socket.');
		}
	}

	async close(): Promise<void> {
		if (!this.server.listening) return;
		await new Promise<void>((resolve) => {
			this.server.close(() => resolve());
			this.server.closeAllConnections();
		});
	}

	private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
		const { agentUid, peerUid } = this.config;
		try {
			if (peerUid(request.socket) !== agentUid) return send(response, 403, { error: 'Forbidden' });
			const { headers, method, url } = request;
			if (headers['transfer-encoding'] || (headers['content-length'] ?? '0') !== '0') {
				return send(response, 400, { error: 'Body not allowed' });
			}
			return await this.route(method, url, response);
		} catch {
			return send(response, 500, { error: 'Private browser error' });
		}
	}

	private async route(
		method: string | undefined,
		url: string | undefined,
		response: ServerResponse
	): Promise<void> {
		const { gate, deviceId, reviewedRead } = this.config;
		if (method === 'GET' && url === '/status') {
			return send(response, 200, { phase: gate.status(), receipt: gate.receipt() });
		}
		if (method === 'POST' && url === '/private-entry') {
			const receipt = await gate.request(deviceId);
			if (receipt) return send(response, 202, receipt);
			return send(response, 409, { error: 'Private entry unavailable' });
		}
		if (method === 'POST' && url === '/read') {
			const result = await gate.read(reviewedRead);
			if (result !== undefined && gate.status() === 'ready') return send(response, 200, { result });
			return send(response, 409, { error: 'Read unavailable' });
		}
		return send(response, 404, { error: 'Unknown route' });
	}
}

function send(response: ServerResponse, status: number, body: object): void {
	const json = JSON.stringify(body);
	response.writeHead(status, {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store',
		Connection: 'close'
	});
	response.end(json);
}
