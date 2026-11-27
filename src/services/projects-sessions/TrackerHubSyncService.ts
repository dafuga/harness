// @harness-uid u_jkomno4o5u
import type { TrackerHubOptions, TrackerHubRequest } from './TrackerHubSyncService.types';
import { readTrackerHubBody, trackerHubResponse } from './tracker-hub-sync/hubHttp';
import { TrackerHubInputError } from './tracker-hub-sync/TrackerHubInputError';
import { TrackerHubPolls } from './tracker-hub-sync/TrackerHubPolls';
import {
	grantDuePermission,
	parseBody,
	recordFleetTelemetry,
	receiveJournalPush
} from './tracker-hub-sync/hubRoutes';
import { readJournalPage } from './tracker-hub-sync/readJournalPage';

/** Serves the Tracker 122e190 sync protocol over an injected HTTP transport and journal. */
export class TrackerHubSyncService {
	readonly #options: TrackerHubOptions;
	readonly #polls: TrackerHubPolls;
	readonly #seen = new Map<string, string>();

	constructor(options: TrackerHubOptions) {
		this.#options = options;
		this.#polls = new TrackerHubPolls((wake) => options.store.subscribe(wake));
	}

	/** Return a JSON HTTP response or reject with the request's cancellation reason. */
	async handle(request: TrackerHubRequest): Promise<Response> {
		const { method, signal } = request;
		try {
			signal?.throwIfAborted();
			const body = method === 'POST' ? await readTrackerHubBody(request) : '';
			signal?.throwIfAborted();
			return await this.authenticateAndRoute(request, body);
		} catch (error) {
			signal?.throwIfAborted();
			if (error instanceof TrackerHubInputError) {
				return trackerHubResponse(error.status, { error: error.message });
			}
			return trackerHubResponse(500, { error: 'internal server error' });
		}
	}

	/** Return a snapshot of the last authenticated contact for each reported node label. */
	peers(): Readonly<Record<string, string>> {
		return Object.fromEntries(this.#seen);
	}

	private authenticateAndRoute(
		request: TrackerHubRequest,
		body: string
	): Response | Promise<Response> {
		const { method, pathAndQuery, headers } = request;
		const now = this.#options.now?.() ?? Date.now();
		const authorization = headers.get('authorization') ?? undefined;
		if (!this.#options.auth.verify({ method, pathAndQuery, body }, authorization, now)) {
			return trackerHubResponse(401, { error: 'unauthorized' });
		}
		// TrackerHMAC authenticates a fleet member. The node header is its reported label.
		const label = headers.get('x-tracker-node') ?? '';
		const peer = label.length === 0 ? '?' : label;
		this.#seen.set(peer, new Date(now).toISOString());
		return this.route(request, body, peer);
	}

	private route(
		request: TrackerHubRequest,
		body: string,
		peer: string
	): Response | Promise<Response> {
		const { method, pathAndQuery, signal } = request;
		const queryStart = pathAndQuery.indexOf('?');
		const path = queryStart < 0 ? pathAndQuery : pathAndQuery.slice(0, queryStart);
		const store = this.#options.store;
		switch (`${method} ${path}`) {
			case 'POST /sync/push':
				return receiveJournalPush(store, body);
			case 'GET /sync/pull':
				return readJournalPage(
					this.#options,
					this.#polls,
					new URLSearchParams(queryStart < 0 ? '' : pathAndQuery.slice(queryStart)),
					signal
				);
			case 'GET /sync/health':
				return trackerHubResponse(200, {
					ok: true,
					hub: store.node,
					db_id: store.dbId,
					max: store.maxSeq()
				});
			case 'POST /sync/permit-automatic':
			case 'POST /sync/permit-due':
				return grantDuePermission(this.#options, body, peer, path.endsWith('automatic'));
			case 'POST /sync/machine':
				return recordFleetTelemetry(this.#options, body, peer);
			default:
				return coordinateHubRequest(this.#options, { method, path, body, peer });
		}
	}
}

function coordinateHubRequest(
	options: TrackerHubOptions,
	request: { method: string; path: string; body: string; peer: string }
) {
	if (request.method !== 'POST' || !['/sync/area-claim', '/sync/landing'].includes(request.path))
		return trackerHubResponse(404, { error: 'not found' });
	const command = request.path === '/sync/landing' ? options.landing : options.claimAreas;
	return command
		? trackerHubResponse(200, command(parseBody(request.body), request.peer))
		: trackerHubResponse(404, { error: 'coordination authority unavailable' });
}
