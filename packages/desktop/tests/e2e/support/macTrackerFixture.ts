import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import type { ElectronApplication } from '../../../../../test/support/browserTest';
import { TrackerItemReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { trackerRunSchema } from '../../../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerRunReadRepository } from '../../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { serveTrackerChanges } from '../../../../../src/services/projects-sessions/tracker-change-feed/serveTrackerChanges';
import { TrackerLocalApiService } from '../../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../../src/services/projects-sessions/TrackerPersistenceService';

async function answer(
	incoming: IncomingMessage,
	outgoing: ServerResponse,
	handle: (request: Request) => Promise<Response>
) {
	const abort = new AbortController();
	outgoing.on('close', () => abort.abort());
	const chunks: Buffer[] = [];
	for await (const chunk of incoming) chunks.push(chunk);
	const reply = await handle(
		new Request(`http://127.0.0.1${incoming.url}`, {
			method: incoming.method,
			body: chunks.length ? Buffer.concat(chunks) : undefined,
			signal: abort.signal
		})
	);
	outgoing.writeHead(reply.status, Object.fromEntries(reply.headers));
	outgoing.end(await reply.text());
}

/**
 * A real Tracker journal, local API and change feed on a spare loopback port. `cut` takes the
 * port down while writes still land in the journal, as when the app loses the tracker.
 */
export async function startMacTrackerFixture() {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, 'fixture-mac');
	database.exec(trackerRunSchema);
	const api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
		runs: new TrackerRunReadRepository(database, store.node)
	});
	const handle = async (request: Request) =>
		new URL(request.url).pathname === '/changes'
			? serveTrackerChanges(request, store)
			: api.handle(request);
	const server = createServer((incoming, outgoing) => void answer(incoming, outgoing, handle));
	const listen = async (port: number) => {
		server.listen(port, '127.0.0.1');
		await once(server, 'listening');
		return (server.address() as { port: number }).port;
	};
	const cut = () =>
		new Promise<void>((resolve) => {
			server.close(() => resolve());
			server.closeAllConnections();
		});
	const port = await listen(0);
	const post = async (path: string, body: object) => {
		const reply = await api.handle(
			new Request(`http://127.0.0.1${path}`, { method: 'POST', body: JSON.stringify(body) })
		);
		if (!reply.ok) throw new Error(`Tracker refused ${path}: ${reply.status}`);
	};
	return {
		post,
		cut,
		restore: () => listen(port),
		/** A new item with an open question, written to the journal as one agent flag. */
		ask(id: string, title: string) {
			const question = `Proceed: ${title}`;
			const fields = { title, project: 'Fixture', status: 'open', needs_daniel: true, question };
			store.appendLocal({ itemId: id, fields });
		},
		redirect: (app: ElectronApplication) =>
			app.evaluate((_electron, port) => {
				const original = globalThis.fetch;
				globalThis.fetch = ((input, init) => {
					const text = String(input);
					return original(text.replace('//127.0.0.1:7701/', `//127.0.0.1:${port}/`), init);
				}) as typeof fetch;
			}, port),
		async stop() {
			if (server.listening) await cut();
		}
	};
}
