import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runtimeFailure, type RuntimeRequest, type UnitRuntime } from '../core/runtimeTypes';
import { notPortable, portableJson } from '../utils/portableJson';

export interface ServedRuntime {
	url: string;
	close(): Promise<void>;
}

export interface ServeOptions {
	port: number;
	/** Loopback unless a host is given deliberately; the server has no authentication. */
	host?: string;
}

/** Serves any runtime over HTTP so a unit can run as an independently deployed service. */
export class RuntimeServerService {
	async serve(runtime: UnitRuntime, options: ServeOptions): Promise<ServedRuntime> {
		const host = options.host ?? '127.0.0.1';
		const server = createServer((request, response) => {
			void this.respond(runtime, request, response);
		});
		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(options.port, host, resolve);
		});
		const { port } = server.address() as AddressInfo;
		return {
			url: `http://${host}:${port}`,
			close: () =>
				new Promise<void>((resolve) => {
					server.closeAllConnections();
					server.close(() => resolve());
				})
		};
	}

	private async respond(
		runtime: UnitRuntime,
		request: IncomingMessage,
		response: ServerResponse
	): Promise<void> {
		if (request.method !== 'POST') {
			return send(
				response,
				405,
				runtimeFailure('invalid-request', 'send one JSON request per POST')
			);
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(await body(request));
		} catch {
			return send(response, 400, runtimeFailure('invalid-json', 'request is not valid JSON'));
		}
		if (!portableJson(parsed)) return send(response, 400, notPortable);
		return send(response, 200, await runtime.invoke(parsed as RuntimeRequest));
	}
}

async function body(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

function send(response: ServerResponse, status: number, value: unknown): void {
	response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
	response.end(JSON.stringify(value));
}
