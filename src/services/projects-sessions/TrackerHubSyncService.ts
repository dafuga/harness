// @harness-uid u_jkomno4o5u
import {
	outgoingDraftOwnerApi,
	outgoingDraftOwnerPath
} from './tracker-outgoing-draft-service/outgoingDraftOwnerApi';
import {
	outgoingDraftBodyLimit,
	outgoingDraftSyncPath
} from './tracker-outgoing-draft-service/outgoingDraftAgentApi';
import { serveSyncedDraft } from './tracker-hub-sync/serveSyncedDraft';
import type { TrackerHubOptions, TrackerHubRequest } from './TrackerHubSyncService.types';
import { readTrackerHubBody, trackerHubResponse } from './tracker-hub-sync/hubHttp';
import { TrackerHubInputError } from './tracker-hub-sync/TrackerHubInputError';
import { TrackerHubPolls } from './tracker-hub-sync/TrackerHubPolls';
import {
	grantDuePermission,
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
			const draft =
				request.pathAndQuery === outgoingDraftOwnerPath ||
				request.pathAndQuery === outgoingDraftSyncPath;
			const body =
				method === 'POST'
					? await readTrackerHubBody(request, draft ? outgoingDraftBodyLimit : undefined)
					: '';
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
		if (pathAndQuery === outgoingDraftOwnerPath) return this.ownerRoute(request, body, now);
		const authorization = headers.get('authorization') ?? undefined;
		if (!this.#options.auth.verify({ method, pathAndQuery, body }, authorization, now)) {
			return trackerHubResponse(401, { error: 'unauthorized' });
		}
		// TrackerHMAC authenticates a fleet member. The node header is its reported label.
		const label = headers.get('x-tracker-node') ?? '';
		const peer = label.length === 0 ? '?' : label;
		this.#seen.set(peer, new Date(now).toISOString());
		return this.fleetRoute(request, body, peer) ?? this.route(request, body, peer);
	}

	private ownerRoute(request: TrackerHubRequest, body: string, now: number) {
		const { outgoingDrafts: service, outgoingOwnerAuth: auth } = this.#options;
		return service && auth
			? outgoingDraftOwnerApi({ service, auth }, request, body, now)
			: trackerHubResponse(404, { error: 'not found' });
	}

	private fleetRoute(request: TrackerHubRequest, body: string, peer: string) {
		const service = this.#options.outgoingDrafts;
		if (service && request.pathAndQuery === outgoingDraftSyncPath)
			return serveSyncedDraft(service, request.method, body, peer);
		return undefined;
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
				return trackerHubResponse(404, { error: 'not found' });
		}
	}
}
