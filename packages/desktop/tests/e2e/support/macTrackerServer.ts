import { createServer } from 'node:http';
import type { ElectronApplication } from '../../../../../test/support/browserTest';
import type { TrackerLocalApiService } from '../../../../../src/services/projects-sessions/TrackerLocalApiService';

/** A fixture Tracker API on a free loopback port, and the app's fixed Tracker address sent to it. */
export function serve(api: TrackerLocalApiService) {
	return createServer(async (request, response) => {
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(chunk);
			const message = new Request(`http://127.0.0.1${request.url}`, {
				method: request.method,
				body: chunks.length ? Buffer.concat(chunks) : undefined
			});
			const reply = await api.handle(message);
			response.writeHead(reply.status, Object.fromEntries(reply.headers));
			response.end(await reply.text());
		} catch {
			response.writeHead(500).end();
		}
	});
}

export async function redirectTracker(app: ElectronApplication, port: number) {
	await app.evaluate((_electron, port) => {
		const original = globalThis.fetch;
		globalThis.fetch = ((input, init) => {
			if (!String(input).startsWith('http://127.0.0.1:7701/')) return original(input, init);
			const url = new URL(String(input));
			url.port = String(port);
			return original(url, init);
		}) as typeof fetch;
	}, port);
}
