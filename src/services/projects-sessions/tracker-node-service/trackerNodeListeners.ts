// @harness-uid u_gvqtr5mdwv
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerSupervisorService } from '../TrackerSupervisorService';
import { stopTrackerRun, trackerLaunchAwareItemResponse } from './confirmTrackerLaunch';
import { readTrackerNodeInspection } from './readTrackerNodeInspection';
import { serveTrackerChanges } from '../tracker-change-feed/serveTrackerChanges';

const host = '127.0.0.1';
const nativePrefix = '/native/v1';

export function bindTrackerListener(
	port: number,
	type: 'api' | 'sync',
	signal: AbortSignal,
	handle: (request: Request) => Promise<Response> | Response
) {
	const pending = new Set<Promise<Response>>();
	const listener = Bun.serve({
		hostname: host,
		port,
		reusePort: false,
		idleTimeout: type === 'sync' ? 70 : 30,
		fetch(request, server) {
			const origin = `http://${host}:${server.port}`;
			if (!allowedLocalRequest(request, origin, type))
				return Response.json({ error: 'loopback request required' }, { status: 403 });
			if (signal.aborted) return unavailable();
			if (type === 'api' && /\/adapters\/run$/.test(new URL(request.url).pathname))
				server.timeout(request, 120);
			const lifetime = AbortSignal.any([signal, request.signal]);
			const work = Promise.resolve()
				.then(() => handle(new Request(request, { signal: lifetime })))
				.catch(() => Response.json({ error: 'Tracker request failed' }, { status: 503 }))
				.finally(() => pending.delete(work));
			pending.add(work);
			return work;
		}
	});
	return {
		port: listener.port ?? port,
		async close() {
			await listener.stop(true);
			await Promise.allSettled(pending);
		}
	};
}

function allowedLocalRequest(request: Request, origin: string, type: 'api' | 'sync'): boolean {
	const incoming = request.headers.get('origin');
	if (type === 'sync') return incoming === null;
	return request.headers.get('host') === origin.slice(7) && (!incoming || incoming === origin);
}

export function unavailable(): Response {
	return Response.json({ error: 'Tracker service is not ready' }, { status: 503 });
}

export function trackerNodeApi(
	request: Request,
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService,
	checkpoint: string
) {
	const url = new URL(request.url);
	if (url.pathname.startsWith(nativePrefix + '/')) {
		return trackerNativeApi(request, runtime, supervisor, checkpoint);
	}
	return trackerCompatibleApi(request, runtime, supervisor, checkpoint);
}

function trackerNativeApi(
	request: Request,
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService,
	checkpoint: string
) {
	if (
		request.headers.get('x-harness-tracker-node') !== runtime.store.node ||
		request.headers.get('x-harness-tracker-role') !== runtime.role
	) {
		return Response.json({ error: 'Tracker node or role does not match' }, { status: 409 });
	}
	const url = new URL(request.url);
	url.pathname = url.pathname.slice(nativePrefix.length);
	return trackerCompatibleApi(new Request(url, request), runtime, supervisor, checkpoint);
}

function trackerCompatibleApi(
	request: Request,
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService,
	checkpoint: string
) {
	const path = new URL(request.url).pathname;
	switch (`${request.method} ${path}`) {
		case 'GET /health':
			return Response.json({
				app: 'tracker',
				version: 'harness-native',
				ok: true,
				pid: process.pid,
				node: runtime.store.node,
				role: runtime.role
			});
		case 'GET /status':
			return trackerNodeStatus(runtime, supervisor, checkpoint);
		case 'GET /changes':
			return serveTrackerChanges(request, runtime.store);
		case 'POST /adapters/run':
			return trackerAdapterRun(request, runtime);
		default:
			return trackerOperationalApi(request, runtime, supervisor, path);
	}
}

function trackerOperationalApi(
	request: Request,
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService,
	path: string
) {
	switch (`${request.method} ${path}`) {
		case 'GET /watchdog/dry-run':
			return trackerWatchdogDryRun(request, runtime);
		case 'GET /needs-attention':
		case 'GET /watchdog/alerts':
			return Response.json(runtime.watchdog?.alerts() ?? []);
		case 'POST /backup/now':
			return trackerBackupNow(runtime);
		case 'POST /stop':
			return stopTrackerRun(request, runtime);
		case 'POST /sync':
			runtime.kickLinks();
			return Response.json({ ok: true });
		default: {
			const inspection =
				request.method === 'GET' ? readTrackerNodeInspection(path, runtime, supervisor) : undefined;
			return inspection ?? trackerLaunchAwareItemResponse(request, runtime);
		}
	}
}

async function trackerBackupNow({ backups }: TrackerNativeRuntimeService) {
	if (!backups)
		return Response.json({ error: 'native backups are not enabled on this node' }, { status: 409 });
	return Response.json(await backups.service.take());
}

function trackerNodeStatus(
	runtime: TrackerNativeRuntimeService,
	supervisor: TrackerSupervisorService,
	checkpoint: string
) {
	return Response.json({
		...supervisor.status(),
		native: {
			checkpoint,
			watchdog: runtime.watchdog ? 'configured' : 'external process ports required',
			cos_watchdog_tick: runtime.watchdog?.chiefOfStaff
				? 'configured'
				: 'external scheduler required',
			provider_runner: runtime.scheduler ? 'configured' : 'disabled',
			job_runner: 'disabled',
			adapter_runner: runtime.adapter ? 'configured' : 'disabled',
			host_effects_held: runtime.hostEffectsHeld,
			notification_tick: Boolean(runtime.notifications),
			recurrence_tick: Boolean(runtime.recurring)
		}
	});
}

async function trackerWatchdogDryRun(request: Request, runtime: TrackerNativeRuntimeService) {
	const item = new URL(request.url).searchParams.get('item');
	const result = await runtime.watchdog?.inspect(item, request.signal);
	return Response.json(
		result ?? { computer: runtime.store.node, available: false, sessions: [], recovery: [] }
	);
}

async function trackerAdapterRun(request: Request, { adapter }: TrackerNativeRuntimeService) {
	if (!adapter?.status().active)
		return Response.json(
			{ error: 'Run adapters on the designated Tracker runner' },
			{ status: 409 }
		);
	const query = new URL(request.url).searchParams;
	const source = query.get('source');
	if (!source || !/^github:[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/.test(source))
		return Response.json({ error: 'A GitHub adapter source ID is required' }, { status: 400 });
	try {
		const result = await adapter.poll(source, {
			dryRun: query.get('dry-run') === '1',
			backfillComments: query.get('backfill-comments') === '1',
			signal: request.signal
		});
		switch (result.status) {
			case 'polled':
				return Response.json(result);
			case 'inactive':
				return Response.json({ error: 'Tracker adapter is missing or paused' }, { status: 404 });
			default:
				return Response.json(
					{ error: 'Tracker adapter is busy or owned by another node' },
					{ status: 409 }
				);
		}
	} catch {
		return Response.json({ error: 'Tracker adapter intake failed' }, { status: 502 });
	}
}

export function trackerNodeSync(request: Request, runtime: TrackerNativeRuntimeService) {
	const url = new URL(request.url);
	if (!runtime.sync || !url.pathname.startsWith('/sync/'))
		return Response.json({ error: 'no route' }, { status: 404 });
	return runtime.sync.handle({
		method: request.method,
		pathAndQuery: url.pathname + url.search,
		headers: request.headers,
		body: request.body,
		signal: request.signal
	});
}
