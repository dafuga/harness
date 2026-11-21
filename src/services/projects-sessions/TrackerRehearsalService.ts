// @harness-uid u_q52bxqlyeg
import { tryAcquireTrackerSqliteLease } from '../../adapters/projects-sessions/TrackerAdapterLeaseAdapter';
import { TrackerSupervisorService } from './TrackerSupervisorService';
import { openSqlite } from '../../adapters/development-tooling/openSqlite';
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import { TrackerNativeRuntimeService } from './TrackerNativeRuntimeService';

const host = '127.0.0.1';

/** Binds an isolated loopback listener before opening the rehearsal journal. */
export class TrackerRehearsalService {
	async start(databasePath: string, node: string, port: number) {
		const release = tryAcquireTrackerSqliteLease(databasePath + '.supervisor-lock.sqlite');
		if (!release) throw new Error('Tracker rehearsal database is already owned');
		const controller = new AbortController();
		const health = rehearsalHealth(node);
		let database: SqliteDatabase | undefined;
		let runtime: TrackerNativeRuntimeService | undefined;
		let supervisor: TrackerSupervisorService | undefined;
		let server: ReturnType<typeof bindLoopback> | undefined;
		let workers: Promise<void> | undefined;
		let closing: Promise<void> | undefined;
		const close = () =>
			(closing ??= stopRehearsal({ server, workers, controller }, database, release));
		try {
			server = bindLoopback(port, (request) => {
				if (!runtime || !supervisor) return Response.json({ error: 'starting' }, { status: 503 });
				const path = new URL(request.url).pathname;
				if (request.method === 'GET' && path === '/health') return Response.json(health);
				if (request.method === 'GET' && path === '/status')
					return Response.json(supervisor.status());
				return runtime.items.handle(request);
			});
			database = openSqlite(databasePath);
			runtime = new TrackerNativeRuntimeService(database, { node, role: 'spoke' });
			supervisor = new TrackerSupervisorService(runtime, {
				now: () => Date.parse(health.started_at)
			});
			workers = supervisor.run(controller.signal);
			return { port: server.port, node, pid: health.pid, close };
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
		controller
	}: {
		server?: ReturnType<typeof bindLoopback>;
		workers?: Promise<void>;
		controller: AbortController;
	},
	database: SqliteDatabase | undefined,
	release: () => void
) {
	controller.abort();
	try {
		const results = await Promise.allSettled([server?.stop(true), workers]);
		const rejected = results.find((result) => result.status === 'rejected');
		if (rejected?.status === 'rejected') throw rejected.reason;
	} finally {
		try {
			database?.close();
		} finally {
			release();
		}
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
