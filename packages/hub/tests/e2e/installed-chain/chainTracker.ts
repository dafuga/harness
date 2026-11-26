import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { TrackerItemReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { trackerRunSchema } from '../../../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerRunReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { serveTrackerChanges } from '../../../../../src/services/projects-sessions/tracker-change-feed/serveTrackerChanges';
import { TrackerLocalApiService } from '../../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../../src/services/projects-sessions/TrackerPersistenceService';

async function respond(
	handle: (request: Request) => Response | Promise<Response>,
	incoming: IncomingMessage,
	outgoing: ServerResponse
) {
	const abort = new AbortController();
	outgoing.on('close', () => abort.abort());
	const chunks: Buffer[] = [];
	for await (const chunk of incoming) chunks.push(chunk);
	const reply = await handle(
		new Request(`http://127.0.0.1${incoming.url}`, {
			method: incoming.method,
			headers: incoming.headers as Record<string, string>,
			body: chunks.length ? Buffer.concat(chunks) : undefined,
			signal: abort.signal
		})
	);
	outgoing.writeHead(reply.status, Object.fromEntries(reply.headers));
	outgoing.end(await reply.text());
}

/**
 * The real Tracker journal and local API, in memory, on a spare loopback port. It never listens
 * on the real Tracker's port.
 */
export async function startChainTracker() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-mac');
	database.exec(trackerRunSchema);
	const items = new TrackerItemReadRepository(database);
	const api = new TrackerLocalApiService(store, items, {
		runs: new TrackerRunReadRepository(database, store.node)
	});
	const handle = (request: Request) => {
		const path = new URL(request.url).pathname;
		if (path === '/changes') return serveTrackerChanges(request, store);
		if (path === '/machines') return Response.json([]);
		return api.handle(request);
	};
	const server = createServer((incoming, outgoing) => {
		void respond(handle, incoming, outgoing).catch(() => outgoing.destroy());
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const { port } = server.address() as { port: number };
	return {
		origin: `http://127.0.0.1:${port}`,
		item: (id: string) => items.get(id),
		add(id: string, fields: { title: string; agent: string }) {
			store.appendLocal({
				itemId: id,
				fields: { ...fields, project: fields.agent, status: 'in_progress', kind: 'task' }
			});
		},
		/** A write as the tracker CLI makes it. */
		async post(path: string, body: object) {
			const request = new Request(`http://127.0.0.1${path}`, {
				method: 'POST',
				body: JSON.stringify(body)
			});
			const reply = await api.handle(request);
			if (!reply.ok) throw new Error(`Tracker refused ${path}: ${reply.status}`);
		},
		stop() {
			server.closeAllConnections();
			server.close();
			database.close();
		}
	};
}
