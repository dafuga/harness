import { once } from 'node:events';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { TrackerItemReadRepository } from '../../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { trackerRunSchema } from '../../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { TrackerRunReadRepository } from '../../../../src/repositories/projects-sessions/TrackerRunReadRepository';
import { serveTrackerChanges } from '../../../../src/services/projects-sessions/tracker-change-feed/serveTrackerChanges';
import { TrackerLocalApiService } from '../../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../../src/services/projects-sessions/TrackerPersistenceService';
import { createHubHomePublisher } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/createHubHomePublisher';
import { TrackerOverviewPublisher } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-overview-publisher/TrackerOverviewPublisher';
import { readProjectOverview } from '$reports/lib/projects-sessions/project-overview/readProjectOverview';
import { startTrackerRealtime } from '../../../desktop/src/lib/development-tooling/desktop-initialization/tracker-realtime/startTrackerRealtime';
import { macToken } from '../../test/support/realtimeToken';
import { startSync } from '../../test/support/syncFixture';

const owner = 'google:fixture-owner';

/** A real Tracker journal and local API with its change feed, on a spare loopback port. */
async function startTracker() {
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
	const server = createServer(async (incoming, outgoing) => {
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
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const { port } = server.address() as { port: number };
	const original = globalThis.fetch;
	globalThis.fetch = ((input, init) => {
		const text = String(input);
		return original(text.replace('http://127.0.0.1:7701/', `http://127.0.0.1:${port}/`), init);
	}) as typeof fetch;
	return {
		/** A write as the tracker CLI makes it. */
		async post(path: string, body: object) {
			const request = new Request(`http://127.0.0.1${path}`, {
				method: 'POST',
				body: JSON.stringify(body)
			});
			const reply = await api.handle(request);
			if (!reply.ok) throw new Error(`Tracker refused ${path}: ${reply.status}`);
		},
		/** An agent's structured ask, as `tracker flag --option` makes it. */
		ask(id: string, question: string) {
			const options = [
				{ label: 'Proceed', effect: 'The work continues', recommended: true },
				{ label: 'Hold', effect: 'The work waits' }
			];
			return this.post(`/items/${id}/flag`, { question, options });
		},
		add: (id: string, title: string) =>
			store.appendLocal({
				itemId: id,
				fields: { title, project: 'Fixture', agent: 'cos', status: 'in_progress' }
			}),
		answer: (id: string) => items.get(id).answer,
		stop() {
			globalThis.fetch = original;
			server.closeAllConnections();
			server.close();
		}
	};
}

/** The Mac's own publisher and realtime wiring against the Hub and account object in workerd. */
export async function startChain() {
	const hub = await startSync({
		entry: fileURLToPath(new URL('../../test/support/realtimeWorker.ts', import.meta.url)),
		migrations: ['0005-hub-home-chat']
	});
	const tracker = await startTracker();
	const env = {
		HARNESS_TRACKER_OVERVIEW_PUBLISH: '1',
		HARNESS_HUB_HOME_PUBLISH: '1',
		HARNESS_TRACKER_OVERVIEW_OWNER_ACTOR_ID: owner
	};
	const authority = {
		authorize: async () => ({ origin: hub.origin, principalId: owner, token: macToken }),
		version: () => 1,
		put: async () => undefined
	};
	// No quota sources: a test never reads this computer's provider accounts.
	const publisher = new TrackerOverviewPublisher({
		authority,
		ownerActorId: owner,
		read: () => readProjectOverview(),
		publishHome: createHubHomePublisher(undefined, [])
	});
	publisher.start();
	const stopRealtime = startTrackerRealtime({ publisher, authority, env, emit: () => {} });
	return {
		hub,
		tracker,
		async stop() {
			stopRealtime();
			publisher.stop();
			tracker.stop();
			await hub.stop();
		}
	};
}
