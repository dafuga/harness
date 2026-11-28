// @harness-uid u_g7kdpz7bel
import type { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { checkTrackerItem } from '../../utils/projects-sessions/checkTrackerItem';
import { trackerHostWorkEndpoint } from './tracker-local-api-service/trackerHostWorkEndpoint';
import { readTrackerMachineEndpoint } from './tracker-local-api-service/readTrackerMachineEndpoint';
import { readTrackerAttachmentEndpoint } from './tracker-local-api-service/readTrackerAttachmentEndpoint';
import { trackerJobResponse } from './tracker-local-api-service/trackerLocalJobResponse';
import { trackerMessageEndpoint } from './tracker-local-api-service/trackerLocalMessages';
import {
	trackerFailureResponse,
	trackerResponse
} from './tracker-local-api-service/trackerLocalResponse';
import { readChiefReviews } from './tracker-local-api-service/readTrackerChiefReviews';
import { writeTrackerItem } from './tracker-local-api-service/writeTrackerItem';
import { readActor } from './tracker-local-api-service/trackerLocalActor';
import { trackerRejectItem } from './tracker-local-api-service/trackerLocalRejection';
import {
	isTrackerAlert,
	trackerAlertResponse
} from './tracker-local-api-service/trackerLocalAlert';
import { phoneReplicaResponse } from './tracker-local-api-service/trackerPhoneReplicaResponse';
import { trackerInboxItem } from './tracker-local-api-service/trackerLocalInbox';
import { writeTrackerPlanning } from './tracker-local-api-service/trackerLocalPlanning';
import type {
	TrackerLocalApiDependencies,
	TrackerLocalApiOptions
} from './TrackerLocalApiService.types';
import {
	readTrackerItemDetail,
	readTrackerRunEndpoint
} from './tracker-local-api-service/readTrackerRunEndpoint';
import type { TrackerPersistenceService } from './TrackerPersistenceService';

/** Handles core item requests for the loopback listener over its shared Tracker journal. */
export class TrackerLocalApiService {
	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly items: TrackerItemReadRepository,
		private readonly options: TrackerLocalApiOptions = {}
	) {}

	async handle(request: Request): Promise<Response> {
		try {
			const url = new URL(request.url);
			const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
			const phone = phoneReplicaResponse(request, url, {
				replica: this.options.phoneReplica,
				respond: trackerResponse
			});
			if (phone) return await phone;
			const special = trackerSpecialResponse(request, parts, {
				store: this.store,
				items: this.items,
				options: this.options
			});
			if (special) return await special;
			if (request.method === 'GET') {
				const read = this.read(parts, Object.fromEntries(url.searchParams));
				if (read) return read;
			}
			if (parts[0] === 'items' && parts.length <= 3) {
				const write = await writeTrackerItem(request, parts, {
					store: this.store,
					items: this.items,
					options: this.options
				});
				if (write) return write;
			}
			return trackerResponse(404, { error: `no route ${request.method} ${url.pathname}` });
		} catch (error) {
			if (error instanceof URIError) return trackerResponse(400, { error: 'invalid item path' });
			return trackerFailureResponse(error);
		}
	}

	private read(parts: string[], query: Record<string, string>): Response | undefined {
		switch (parts[0]) {
			case 'items': {
				const response = this.readItems(parts, query);
				if (response) return response;
				break;
			}
			case 'check':
				return trackerResponse(
					200,
					checkTrackerItem(this.items.candidates(), query.text, { agent: query.agent })
				);
			case 'digest': {
				const now = this.options.now?.() ?? Date.now();
				const timeZone = this.options.timeZone;
				const digest =
					query.format === 'text'
						? this.items.digestText(now, timeZone)
						: this.items.digest(now, timeZone);
				return trackerResponse(200, digest);
			}
		}
		const machine = readTrackerMachineEndpoint(parts, query, this.options.machines);
		if (machine) return trackerResponse(machine.status, machine.body);
		const run = readTrackerRunEndpoint(parts, query, { ...this.options, items: this.items });
		return run === undefined ? undefined : trackerResponse(200, run);
	}
	private readItems(parts: string[], query: Record<string, string>): Response | undefined {
		if (parts.length === 1)
			return trackerResponse(200, this.items.list(query, this.options.now?.()));
		if (parts.length === 2)
			return trackerResponse(200, readTrackerItemDetail(this.items.get(parts[1]), this.options));
		const attached = readTrackerAttachmentEndpoint(this.items, parts);
		if (attached) return trackerResponse(attached.status, attached.body);
		if (parts.length === 3 && parts[2] === 'history' && this.options.recurring)
			return this.readHistory(parts[1], query.limit);
		return undefined;
	}

	private readHistory(id: string, rawLimit?: string): Response {
		const recurring = this.options.recurring;
		if (recurring?.role === 'spoke')
			return trackerResponse(409, {
				error: 'run tracker history on the box (the hub keeps the run history)'
			});
		const limit = Number(rawLimit) || 50;
		if (!Number.isSafeInteger(limit))
			return trackerResponse(400, { error: 'invalid history limit' });
		const item = this.items.resolve(id);
		return trackerResponse(200, recurring?.history?.(item.id, limit) ?? []);
	}
}

function trackerSpecialResponse(
	request: Request,
	parts: string[],
	dependencies: TrackerLocalApiDependencies
) {
	if (parts.length === 1 && parts[0] === 'host-work' && dependencies.options.machines)
		return trackerHostWorkEndpoint(request, dependencies.options.machines);
	if (request.method === 'GET' && parts[0] === 'review' && parts.length <= 2)
		return Promise.resolve(readChiefReviews(dependencies, parts[1], readActor(request.headers)));
	if (parts[0] === 'jobs') return trackerJobResponse(request, parts, dependencies);
	if (isTrackerAlert(request, parts)) return trackerAlertResponse(request, parts[1], dependencies);
	if (parts[0] === 'messages')
		return trackerMessageEndpoint(request, parts, {
			...dependencies,
			actor: readActor(request.headers)
		}).then((result) =>
			result
				? trackerResponse(result.status, result.body)
				: trackerResponse(404, { error: `no route ${request.method} /${parts.join('/')}` })
		);
	return trackerItemSpecialResponse(request, parts, dependencies);
}

function trackerItemSpecialResponse(
	request: Request,
	parts: string[],
	dependencies: TrackerLocalApiDependencies
): Promise<Response> | undefined {
	if (!/^items\/[^/]+\/(?:inbox|stage|artifact|reject)$/.test(parts.join('/'))) return undefined;
	const [, id, verb] = parts;
	const actor = readActor(request.headers);
	if (verb === 'inbox')
		return trackerInboxItem(request, id, { ...dependencies, actor }).then((item) =>
			trackerResponse(200, item)
		);
	if (request.method === 'POST' && verb === 'reject')
		return trackerRejectItem(request, id, { ...dependencies, actor }).then((item) =>
			trackerResponse(200, item)
		);
	if (request.method !== 'POST' || (verb !== 'stage' && verb !== 'artifact')) return undefined;
	return writeTrackerPlanning(
		request,
		{ id, verb, actor },
		{
			...dependencies,
			now: dependencies.options.now?.() ?? Date.now()
		}
	).then((item) => trackerResponse(200, item));
}
