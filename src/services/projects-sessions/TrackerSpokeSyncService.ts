// @harness-uid u_657a3wmun2
import { z } from 'zod';
import { TrackerSyncAuthService } from '../networking-security/TrackerSyncAuthService';
import type {
	TrackerSpokeOptions,
	TrackerSpokePullResult,
	TrackerSpokeRequest,
	TrackerSpokeStore,
	TrackerSpokeTransport
} from './TrackerSpokeSyncService.types';

const pushBatchSize = 500;

function trackerMetaKeys(prefix: string) {
	return {
		identity: `${prefix}hub_db_id`,
		pull: `${prefix}pull_cursor`,
		push: `${prefix}pushed_seq`,
		replay: `${prefix}push_all`
	};
}

function signTrackerSpokeRequest(
	auth: TrackerSyncAuthService,
	node: string,
	request: Omit<TrackerSpokeRequest, 'headers' | 'timeoutMs'>,
	timeoutMs: number
): TrackerSpokeRequest {
	return {
		...request,
		timeoutMs,
		headers: {
			authorization: auth.authorizationHeader(request),
			'content-type': 'application/json',
			'x-tracker-node': node
		}
	};
}

/** Syncs one Tracker hub or peer link using the spoke's durable journal. */
export class TrackerSpokeSyncService {
	readonly #store: TrackerSpokeStore;
	readonly #transport: TrackerSpokeTransport;
	readonly #auth: TrackerSyncAuthService;
	readonly #keys: ReturnType<typeof trackerMetaKeys>;
	readonly #relayOps: boolean;
	readonly #wait: number;
	#identityVersion = 0;
	#pushing?: Promise<number>;
	#pulling?: Promise<TrackerSpokePullResult>;

	constructor({
		store,
		transport,
		secret,
		link = 'hub',
		relayOps = link === 'peer',
		pullWaitSeconds = 25
	}: TrackerSpokeOptions) {
		this.#store = store;
		this.#transport = transport;
		this.#auth = new TrackerSyncAuthService(secret);
		this.#keys = trackerMetaKeys(link === 'peer' ? 'peer_' : '');
		this.#relayOps = relayOps;
		this.#wait = pullWaitSeconds;
	}

	/** Drain pending batches. A failed request leaves its batch eligible for the next call. */
	push(): Promise<number> {
		return (this.#pushing ??= Promise.resolve()
			.then(() => this.#drainPush())
			.finally(() => {
				this.#pushing = undefined;
			}));
	}

	/** Poll once. A reset requests immediate push replay and another poll from zero. */
	pull(): Promise<TrackerSpokePullResult> {
		return (this.#pulling ??= Promise.resolve()
			.then(() => this.#poll())
			.finally(() => {
				this.#pulling = undefined;
			}));
	}

	async #drainPush(): Promise<number> {
		const { push, replay } = this.#keys;
		let acknowledged = 0;
		for (;;) {
			const sendAll = this.#store.getMeta(replay) === '1';
			const filter = sendAll || this.#relayOps ? undefined : { onlyNode: this.#store.node };
			const ops = this.#store.opsSince(this.#cursor(push), pushBatchSize, filter);
			const tail = ops.at(-1);
			if (!tail) {
				if (sendAll) this.#store.writeMeta({ [replay]: '0' });
				return acknowledged;
			}
			const version = this.#identityVersion;
			const body = JSON.stringify({ node: this.#store.node, ops });
			const response = await this.#request(
				{ method: 'POST', pathAndQuery: '/sync/push', body },
				30_000
			);
			if (version !== this.#identityVersion) continue;
			if (this.#acceptIdentity(decodeTrackerPushReceipt(response))) continue;
			this.#store.writeMeta({ [push]: String(tail.seq) });
			acknowledged += ops.length;
		}
	}

	async #poll(): Promise<TrackerSpokePullResult> {
		const key = this.#keys.pull;
		const since = this.#cursor(key);
		const version = this.#identityVersion;
		const pathAndQuery = `/sync/pull?since=${since}&wait=${this.#wait}`;
		const response = await this.#request({ method: 'GET', pathAndQuery }, (this.#wait + 15) * 1000);
		if (version !== this.#identityVersion) return { status: 'stale' };
		const { ops, last, db_id, hub, due_policy } = decodeTrackerPullPage(response, since);
		if (this.#acceptIdentity(db_id)) return { status: 'reset' };
		// If the cursor write fails, the journal deduplicates the same operations on retry.
		this.#store.applyOps(ops.map(({ seq: _remoteSequence, ...op }) => op));
		this.#store.writeMeta({ [key]: String(last) });
		return {
			status: 'applied',
			last,
			hub,
			...(due_policy !== undefined ? { duePolicy: due_policy } : {})
		};
	}

	#acceptIdentity(dbId: string): boolean {
		const { identity, pull, push, replay } = this.#keys;
		const known = this.#store.getMeta(identity);
		if (known === dbId) return false;
		const reset = Boolean(known);
		const entries = reset
			? { [identity]: dbId, [pull]: '0', [push]: '0', [replay]: '1' }
			: { [identity]: dbId };
		this.#store.writeMeta(entries);
		this.#identityVersion++;
		return reset;
	}

	#cursor(key: string): number {
		const cursor = Number(this.#store.getMeta(key));
		if (!Number.isSafeInteger(cursor) || cursor < 0)
			throw new Error('Invalid Tracker stored cursor');
		return cursor;
	}

	#request(
		request: Omit<TrackerSpokeRequest, 'headers' | 'timeoutMs'>,
		timeoutMs: number
	): Promise<unknown> {
		return this.#transport(
			signTrackerSpokeRequest(this.#auth, this.#store.node, request, timeoutMs)
		);
	}
}

const identity = z.string().min(1);
const sequence = z.int().nonnegative();
const pushReceipt = z.object({ ok: z.literal(true), db_id: identity });
const pullPage = z.object({
	db_id: identity,
	hub: z.string(),
	last: sequence,
	max: sequence,
	due_policy: z.unknown().optional(),
	ops: z.array(
		z.looseObject({
			seq: sequence,
			op_id: z.string(),
			item_id: z.string(),
			fields: z.record(z.string(), z.unknown()),
			hlc: z.string(),
			node: z.string(),
			actor: z.string().nullable().optional()
		})
	)
});

function decodeTrackerPushReceipt(reply: unknown): string {
	const parsed = pushReceipt.safeParse(reply);
	if (!parsed.success) throw new Error('Invalid Tracker push receipt');
	return parsed.data.db_id;
}

function decodeTrackerPullPage(reply: unknown, since: number) {
	const parsed = pullPage.safeParse(reply);
	if (!parsed.success) throw new Error('Invalid Tracker pull page');
	const page = parsed.data;
	let last = Math.min(since, page.max);
	for (const { seq } of page.ops) {
		if (seq <= since || seq <= last) throw new Error('Invalid Tracker pull page sequence');
		last = seq;
	}
	if (last > page.max || last !== page.last) throw new Error('Invalid Tracker pull page cursor');
	return page;
}
