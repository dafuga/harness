// @harness-uid u_g7kdpz7bel
import { randomUUID } from 'node:crypto';
import type { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { checkTrackerItem } from '../../utils/projects-sessions/checkTrackerItem';
import { planTrackerItemMutation } from '../../utils/projects-sessions/planTrackerItemMutation';
import type { TrackerItemMutationContext } from '../../utils/projects-sessions/planTrackerItemMutation.types';
import {
	itemAction,
	itemMutation,
	readItemBody,
	recordTrackerSessionItem
} from './tracker-local-api-service/trackerLocalItemMutation';
import type { TrackerLocalApiOptions } from './TrackerLocalApiService.types';
import {
	readTrackerItemDetail,
	readTrackerRunEndpoint
} from './tracker-local-api-service/readTrackerRunEndpoint';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type { TrackerPhoneReplicaService } from './TrackerPhoneReplicaService';
import {
	isTrackerManualLaunch,
	planTrackerManualLaunch
} from './tracker-local-api-service/trackerManualLaunch';

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
			const phone = phoneReplicaResponse(request, url, this.options.phoneReplica);
			if (phone) return await phone;
			if (request.method === 'GET') {
				const read = this.read(parts, Object.fromEntries(url.searchParams));
				if (read) return read;
			}
			if (parts[0] === 'items' && parts.length <= 3) {
				const write = await this.write(request, parts);
				if (write) return write;
			}
			return trackerResponse(404, { error: `no route ${request.method} ${url.pathname}` });
		} catch (error) {
			if (error instanceof URIError) return trackerResponse(400, { error: 'invalid item path' });
			return failureResponse(error);
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
		const run = readTrackerRunEndpoint(parts, query, { ...this.options, items: this.items });
		return run === undefined ? undefined : trackerResponse(200, run);
	}

	private readItems(parts: string[], query: Record<string, string>): Response | undefined {
		if (parts.length === 1) return trackerResponse(200, this.items.list(query));
		if (parts.length === 2)
			return trackerResponse(200, readTrackerItemDetail(this.items.get(parts[1]), this.options));
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

	private async write(request: Request, [, id, verb]: string[]): Promise<Response | undefined> {
		const action = itemAction(request.method, id, verb);
		const manual =
			this.options.manualLaunch && request.method === 'POST' && id && isTrackerManualLaunch(verb);
		if (!action && !manual) return undefined;
		const body = await readItemBody(request);
		request.signal.throwIfAborted();
		const context = this.mutationContext();
		const plan = action
			? planTrackerItemMutation(itemMutation(action, id, body, this.items), context)
			: planTrackerManualLaunch(verb, this.items.resolve(id), body, context);
		const persist =
			action === 'start'
				? () => recordTrackerSessionItem(this.store.database, plan.itemId, body.session_run)
				: undefined;
		if (plan.fields)
			this.store.appendLocal(
				{ itemId: plan.itemId, fields: plan.fields, actor: readActor(request.headers) },
				persist
			);
		return writeResponse(this.items, this.options, { action, verb, itemId: plan.itemId });
	}

	private mutationContext(): TrackerItemMutationContext {
		const { planLaunch, runs } = this.options;
		return {
			node: this.store.node,
			now: this.options.now?.() ?? Date.now(),
			timeZone: this.options.timeZone,
			launchNonce: randomUUID(),
			candidates: this.items.candidates(),
			validateModel: this.options.validateModel,
			planLaunch:
				planLaunch &&
				((fields, current) =>
					planLaunch(
						fields,
						current?.auto && runs?.launchConsumed(current.id, current.auto)
							? { ...current, auto: null }
							: current
					))
		};
	}
}

/** A manual launch answers with the item's launch status; other writes answer with the stored item. */
function writeResponse(
	items: TrackerItemReadRepository,
	options: TrackerLocalApiOptions,
	{ action, verb, itemId }: { action?: string; verb?: string; itemId: string }
): Response {
	if (!action && verb === 'launch')
		return trackerResponse(200, readTrackerItemDetail(items.get(itemId), options));
	return trackerResponse(action === 'add' ? 201 : 200, items.getStored(itemId));
}

function phoneReplicaResponse(request: Request, url: URL, replica?: TrackerPhoneReplicaService) {
	if (!replica) return undefined;
	if (request.method === 'GET' && url.pathname === '/phone-replica/v1')
		return replica.pull(url.searchParams);
	if (request.method === 'POST' && url.pathname === '/phone-replica/v1/write')
		return phoneWrite(request, replica);
	return undefined;
}

async function phoneWrite(
	request: Request,
	replica: TrackerPhoneReplicaService
): Promise<Response> {
	const { writer } = replica;
	const scope = writer?.scope(request.headers);
	if (!writer || !scope) return trackerResponse(403, { status: 'denied' });
	const body = await readItemBody(request, 4096);
	request.signal.throwIfAborted();
	return trackerResponse(200, writer.push(scope, body));
}

function readActor(headers: Headers): string | null {
	const actor = headers
		.get('x-tracker-as')
		?.replace(/[^\P{Cc}\u0080-\u009f]/gu, '')
		.trim()
		.slice(0, 80);
	if (!actor) return null;
	return actor;
}

function failureResponse(error: unknown): Response {
	if (
		error instanceof Error &&
		'status' in error &&
		typeof error.status === 'number' &&
		error.status >= 400 &&
		error.status < 500
	) {
		const extra = 'body' in error && typeof error.body === 'object' ? error.body : {};
		return trackerResponse(error.status, { error: error.message, ...extra });
	}
	return trackerResponse(500, { error: 'internal server error' });
}

function trackerResponse(status: number, body: unknown): Response {
	const isText = typeof body === 'string';
	return new Response(isText ? body + '\n' : JSON.stringify(body, null, 2), {
		status,
		headers: { 'content-type': isText ? 'text/plain; charset=utf-8' : 'application/json' }
	});
}
