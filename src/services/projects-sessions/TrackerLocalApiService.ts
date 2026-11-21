// @harness-uid u_g7kdpz7bel
import { randomBytes } from 'node:crypto';
import type { TrackerItemReadRepository } from '../../repositories/projects-sessions/TrackerItemReadRepository';
import { checkTrackerItem } from '../../utils/projects-sessions/checkTrackerItem';
import type { TrackerItemInput } from '../../utils/projects-sessions/normalizeTrackerItemFields.types';
import { planTrackerItemMutation } from '../../utils/projects-sessions/planTrackerItemMutation';
import type {
	TrackerItemAction,
	TrackerItemMutation
} from '../../utils/projects-sessions/planTrackerItemMutation.types';
import { trackerItemError } from '../../utils/projects-sessions/trackerItemError';
import { trackerItemTransitions } from '../../utils/projects-sessions/trackerItemTransitions';
import type { TrackerLocalApiOptions } from './TrackerLocalApiService.types';
import { readTrackerRunEndpoint } from './tracker-local-api-service/readTrackerRunEndpoint';
import type { TrackerPersistenceService } from './TrackerPersistenceService';

const itemAlphabet = '0123456789abcdefghjkmnpqrstvwxyz';
const maxBodyBytes = 1024 * 1024;

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
			case 'items':
				if (parts.length === 1) return trackerResponse(200, this.items.list(query));
				if (parts.length === 2) return trackerResponse(200, this.items.get(parts[1]));
				if (parts.length === 3 && parts[2] === 'history' && this.options.recurring)
					return this.readHistory(parts[1], query.limit);
				break;
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
		if (!action) return undefined;
		const body = await readItemBody(request);
		request.signal.throwIfAborted();
		const mutation: TrackerItemMutation =
			action === 'add'
				? { action, itemId: newItemId(), body }
				: { action, item: this.items.resolve(id), body };
		const plan = planTrackerItemMutation(mutation, {
			node: this.store.node,
			now: this.options.now?.() ?? Date.now(),
			timeZone: this.options.timeZone,
			candidates: this.items.candidates(),
			validateModel: this.options.validateModel,
			planLaunch: this.options.planLaunch
		});
		this.store.appendLocal({
			itemId: plan.itemId,
			fields: plan.fields,
			actor: readActor(request.headers)
		});
		return trackerResponse(action === 'add' ? 201 : 200, this.items.getStored(plan.itemId));
	}
}

function itemAction(
	method: string,
	id: string | undefined,
	verb: string | undefined
): TrackerItemAction | 'add' | undefined {
	if (verb) {
		if (method !== 'POST' || verb === 'remove') return undefined;
		return Object.hasOwn(trackerItemTransitions, verb) ? (verb as TrackerItemAction) : undefined;
	}
	if (!id) return method === 'POST' ? 'add' : undefined;
	if (method === 'PATCH') return 'update';
	return method === 'DELETE' ? 'remove' : undefined;
}

function newItemId(): string {
	return Array.from(randomBytes(10), (byte) => itemAlphabet[byte & 31]).join('');
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

async function readItemBody(request: Request): Promise<TrackerItemInput> {
	if (!request.body) return {};
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (let part = await reader.read(); !part.done; part = await reader.read()) {
			size += part.value.byteLength;
			if (size > maxBodyBytes) {
				void reader.cancel().catch(() => {});
				throw trackerItemError('body too large', 413);
			}
			chunks.push(part.value);
		}
	} finally {
		reader.releaseLock();
	}
	return size ? parseItemBody(Buffer.concat(chunks, size).toString('utf8')) : {};
}

function parseItemBody(text: string): TrackerItemInput {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw trackerItemError('invalid JSON body');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw trackerItemError('JSON body must be an object');
	}
	return value as TrackerItemInput;
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
