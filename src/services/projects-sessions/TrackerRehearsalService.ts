// @harness-uid u_q52bxqlyeg
import { tryAcquireTrackerSqliteLease } from '../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { TrackerSupervisorService } from './TrackerSupervisorService';
import { openSqlite } from '../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { TrackerNativeRuntimeService } from './TrackerNativeRuntimeService';
import type { TrackerNativeRuntimeOptions } from './TrackerNativeRuntimeService.types';

const host = '127.0.0.1';

/** Binds an isolated loopback listener before opening the rehearsal journal. */
export class TrackerRehearsalService {
	async start(
		databasePath: string,
		node: string,
		port: number,
		options?: Omit<TrackerNativeRuntimeOptions, 'node'>
	) {
		const release = tryAcquireTrackerSqliteLease(databasePath + '.supervisor-lock.sqlite');
		if (!release)
			throw new DOMException('Tracker rehearsal database is already owned', 'InvalidStateError');
		const controller = new AbortController();
		const health = rehearsalHealth(node, options?.role ?? 'spoke', options?.now ?? Date.now);
		let database: SqliteDatabase | undefined;
		let runtime: TrackerNativeRuntimeService | undefined;
		let supervisor: TrackerSupervisorService | undefined;
		let server: ReturnType<typeof bindLoopback> | undefined;
		let workers: Promise<void> | undefined;
		let closing: Promise<void> | undefined;
		const close = (checkRollback = false) => {
			if (closing) {
				if (checkRollback) return Promise.reject(new Error('Tracker rehearsal is already closing'));
				return closing;
			}
			const afterDrain = checkRollback ? () => supervisor?.assertLegacyRollbackSafe() : undefined;
			return (closing = stopRehearsal(
				{ server, workers, controller, afterDrain },
				database,
				release
			));
		};
		try {
			server = bindLoopback(port, (request) => {
				if (!runtime || !supervisor) return Response.json({ error: 'starting' }, { status: 503 });
				const { pathname: path, search } = new URL(request.url);
				if (request.method === 'GET' && path === '/health') return Response.json(health);
				if (request.method === 'GET' && path === '/status')
					return Response.json(supervisor.status());
				if (runtime.sync && path.startsWith('/sync/')) {
					return runtime.sync.handle({
						method: request.method,
						pathAndQuery: path + search,
						headers: request.headers,
						body: request.body,
						signal: request.signal
					});
				}
				return runtime.items.handle(request);
			});
			database = openSqlite(databasePath);
			runtime = new TrackerNativeRuntimeService(database, { ...options, node, role: health.role });
			supervisor = new TrackerSupervisorService(runtime, {
				now: () => Date.parse(health.started_at)
			});
			workers = supervisor.run(controller.signal);
			return {
				port: server.port,
				node,
				pid: health.pid,
				close: () => close(),
				closeForLegacyRollback: () => close(true)
			};
		} catch (error) {
			await close();
			throw error;
		}
	}
}

async function stopRehearsal(
	{
		server,
		workers,
		controller,
		afterDrain
	}: {
		server?: ReturnType<typeof bindLoopback>;
		workers?: Promise<void>;
		controller: AbortController;
		afterDrain?: () => void;
	},
	database: SqliteDatabase | undefined,
	release: () => void
) {
	controller.abort();
	try {
		const results = await Promise.allSettled([server?.stop(true), workers]);
		const rejected = results.find((result) => result.status === 'rejected');
		if (rejected?.status === 'rejected') throw rejected.reason;
		afterDrain?.();
	} finally {
		try {
			database?.close();
		} finally {
			release();
		}
	}
}

function rehearsalHealth(
	node: string,
	role: TrackerNativeRuntimeOptions['role'],
	now: () => number
) {
	return {
		app: 'tracker',
		ok: true,
		version: 'harness-rehearsal',
		node,
		role,
		pid: process.pid,
		started_at: new Date(now()).toISOString()
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
