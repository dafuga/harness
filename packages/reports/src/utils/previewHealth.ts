import type { Plugin } from "vite";

/** Private health protocol between the supervisor and the exact worker it spawned. */
export interface PreviewHealth {
	protocol: 'harness-worker-v1';
	pid: number;
	errors: number;
	busy: boolean;
}

export const path = '/__harness_worker__';

const sessions = () =>
	(globalThis as unknown as Record<symbol, Map<string, { busy: boolean; close(): void }>>)[
		Symbol.for('harness.console.agents')
	];

/** Give live agents a chance to cancel their owned CLIs before a responsive worker exits. */
export function closePreviewSessions(): void {
	for (const client of sessions()?.values() ?? []) client.close();
}

/** Health bypasses compilation; real server failures are observed without changing responses. */
export function previewHealth(token: string): Plugin {
	let errors = 0,
		last = 0;
	return {
		name: 'harness-preview-health',
		enforce: 'pre',
		configureServer(server) {
			server.middlewares.use((request, response, next) => {
				if (request.url !== path) {
					response.once('finish', () => {
						if (response.statusCode >= 500) {
							errors = Date.now() - last < 30000 ? errors + 1 : 1;
							last = Date.now();
						}
					});
					return next();
				}
				if (request.method !== 'GET' || request.headers['x-harness-worker'] !== token)
					return void response.writeHead(403).end();
				const busy = [...(sessions()?.values() ?? [])].some((client) => client.busy);
				response.writeHead(200, {
					'content-type': 'application/json',
					'cache-control': 'no-store'
				});
				response.end(
					JSON.stringify({ protocol: 'harness-worker-v1', pid: process.pid, errors, busy })
				);
			});
		}
	};
}

export { readPreviewHealth } from '../services/preview-worker-service/previewHealth';
