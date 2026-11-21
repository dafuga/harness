// @harness-uid u_q52bxqlyeg
import { openSqlite } from '../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../repositories/projects-sessions/TrackerRunReadRepository';
import { TrackerLocalApiService } from './TrackerLocalApiService';
import { TrackerPersistenceService } from './TrackerPersistenceService';

const host = '127.0.0.1';

/** Binds an isolated loopback listener before opening the rehearsal journal. */
export class TrackerRehearsalService {
	async start(databasePath: string, node: string, port: number) {
		let database: SqliteDatabase | undefined;
		let api: TrackerLocalApiService | undefined;
		const health = rehearsalHealth(node);
		const server = bindLoopback(port, (request) => {
			if (!api) return Response.json({ error: 'starting' }, { status: 503 });
			if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
				return Response.json(health);
			}
			return api.handle(request);
		});
		try {
			database = openSqlite(databasePath);
			const store = new TrackerPersistenceService(database, node);
			api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), {
				runs: new TrackerRunReadRepository(database, node)
			});
		} catch (error) {
			await server.stop(true);
			database?.close();
			throw error;
		}
		return {
			port: server.port,
			node,
			pid: health.pid,
			close: async () => {
				await server.stop(true);
				database?.close();
			}
		};
	}
}

function rehearsalHealth(node: string) {
	return {
		app: 'tracker',
		ok: true,
		version: 'harness-rehearsal',
		node,
		role: 'spoke',
		pid: process.pid,
		started_at: new Date().toISOString()
	};
}

function bindLoopback(port: number, handle: (request: Request) => Response | Promise<Response>) {
	return Bun.serve({
		hostname: host,
		port,
		reusePort: false,
		fetch(request, listening) {
			const origin = `http://${host}:${listening.port}`;
			if (!authorizedLoopback(request, origin)) {
				return Response.json({ error: 'loopback request required' }, { status: 403 });
			}
			return handle(request);
		}
	});
}

function authorizedLoopback(request: Request, origin: string): boolean {
	const incoming = request.headers.get('origin');
	return (
		request.headers.get('host') === origin.slice('http://'.length) &&
		(!incoming || incoming === origin)
	);
}
