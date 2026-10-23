import type { ServeOptions, ServedRuntime } from './RuntimeServerService.types';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { UnitRuntime } from '../../../core/execution-runtimes/runtimeTypes';
import { runtimeReply } from '../../../utils/execution-runtimes/runtimeReply';

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
		const reply = await runtimeReply(runtime, request.method ?? '', () => body(request));
		response.writeHead(reply.status, {
			'content-type': 'application/json',
			'cache-control': 'no-store'
		});
		response.end(JSON.stringify(reply.value));
	}
}

async function body(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

export type { ServedRuntime, ServeOptions } from './RuntimeServerService.types';
