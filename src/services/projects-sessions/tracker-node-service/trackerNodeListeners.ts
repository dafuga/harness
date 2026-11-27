import { reportDuplicateAdd } from './trackerDuplicateAdd';
import { readItemBody } from '../tracker-local-api-service/trackerLocalItemMutation';
// @harness-uid u_gvqtr5mdwv
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import type { TrackerSupervisorService } from '../TrackerSupervisorService';
import { takeTrackerBackupNow } from '../tracker-backup-service/takeTrackerBackupNow';
import { trackerCommandOrItemResponse } from './trackerAutolaunchCommand';
import { stopTrackerRun } from './confirmTrackerLaunch';
import { extendTrackerSlowRequest } from './extendTrackerSlowRequest';
import { trackerAdapterRoute } from './trackerAdapterRoutes';
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
			if (type === 'api') extendTrackerSlowRequest(request, server);
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
		case 'POST /items':
			return reportDuplicateAdd(runtime.items.handle(request), runtime.store, runtime.now);
		case 'POST /coordination/claim':
		case 'POST /coordination/landing':
			return coordinateTrackerRequest(
				request,
				runtime,
				path.endsWith('/claim') ? 'claim' : 'landing'
			);
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
		case 'POST /backup/now':
			return takeTrackerBackupNow(runtime.backups);
		default:
			return (
				trackerAdapterRoute(request, runtime) ??
				trackerOperationalApi(request, runtime, supervisor, path)
			);
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
		case 'POST /stop':
			return stopTrackerRun(request, runtime);
		case 'POST /sync':
			runtime.kickLinks();
			return Response.json({ ok: true });
		default:
			return trackerCommandOrItemResponse(request, path, runtime, supervisor);
	}
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
			job_runner: runtime.recurring?.status().enabled ? 'configured' : 'disabled',
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

async function coordinateTrackerRequest(
	request: Request,
	runtime: TrackerNativeRuntimeService,
	action: 'claim' | 'landing'
) {
	const port = runtime.dispatch?.coordination;
	if (!port) return Response.json({ error: 'Tracker coordination unavailable' }, { status: 503 });
	try {
		const reply = await port[action](await readItemBody(request));
		return Response.json(reply, { status: reply.allowed || action === 'landing' ? 200 : 409 });
	} catch {
		return Response.json(
			{ error: 'Invalid or unavailable Tracker coordination request' },
			{ status: 400 }
		);
	}
}
