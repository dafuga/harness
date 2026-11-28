// @harness-uid u_657a3wmun2
import { z } from 'zod';
import type { TrackerWireValue } from './TrackerHubSyncService.types';
import { TrackerSyncAuthService } from '../networking-security/TrackerSyncAuthService';
import type {
	TrackerSpokeOptions,
	TrackerSpokePullResult,
	TrackerSpokeRequest,
	TrackerSpokeStore,
	TrackerSpokePostBody
} from './TrackerSpokeSyncService.types';

const pushBatchSize = 500;

export function trackerMetaKeys(prefix: string) {
	return {
		identity: `${prefix}hub_db_id`,
		pull: `${prefix}pull_cursor`,
		push: `${prefix}pushed_seq`,
		replay: `${prefix}push_all`
	};
}

export function createTrackerSpokeRequester(options: TrackerSpokeOptions) {
	const { store, transport } = options;
	const auth = new TrackerSyncAuthService(options.secret);
	return (request: Omit<TrackerSpokeRequest, 'headers' | 'timeoutMs'>, timeoutMs: number) =>
		transport({
			...request,
			timeoutMs,
			headers: {
				authorization: auth.authorizationHeader(request),
				'content-type': 'application/json',
				'x-tracker-node': store.node
			}
		});
}

/** Syncs one Tracker hub or peer link using the spoke's durable journal. */
export class TrackerSpokeSyncService {
	readonly #store: TrackerSpokeStore;
	readonly #request: ReturnType<typeof createTrackerSpokeRequester>;
	readonly #keys: ReturnType<typeof trackerMetaKeys>;
	readonly #relayOps: boolean;
	readonly #wait: number;
	readonly #onPushAcknowledged?: () => void;
	#identityVersion = 0;
	#pushing?: Promise<number>;
	#pulling?: Promise<TrackerSpokePullResult>;

	constructor(options: TrackerSpokeOptions) {
		const peer = options.link === 'peer';
		this.#store = options.store;
		this.#request = createTrackerSpokeRequester(options);
		this.#keys = trackerMetaKeys(peer ? 'peer_' : '');
		this.#relayOps = options.relayOps ?? peer;
		this.#wait = options.pullWaitSeconds ?? 25;
		this.#onPushAcknowledged = options.onPushAcknowledged;
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

	/** A signed, parsed hub decision. Transport or response failures propagate to the owner. */
	async permitDue(id: string, token: string, scope: 'due' | 'automatic' = 'due'): Promise<boolean> {
		const response = await this.#post('/sync/permit-' + scope, { id, token });
		return duePermit.parse(response).allowed;
	}

	async exchangeMachine(sample: TrackerWireValue | undefined, runs: readonly TrackerWireValue[]) {
		const response = await this.#post('/sync/machine', { sample, runs });
		return telemetryResponse.parse(response);
	}

	#post(pathAndQuery: string, body: TrackerSpokePostBody) {
		return this.#request({ method: 'POST', pathAndQuery, body: JSON.stringify(body) }, 30_000);
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
			this.#onPushAcknowledged?.();
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
			throw new TypeError('Invalid Tracker stored cursor');
		return cursor;
	}
}

const identity = z.string().min(1);
const duePermit = z.object({ allowed: z.boolean() });
const telemetryResponse = z.object({
	ok: z.literal(true),
	machines: z.array(z.unknown()),
	run_history: z.array(z.json()).optional()
});
const sequence = z.int().nonnegative();
const pushReceipt = z.object({ ok: z.literal(true), db_id: identity });
const pullPage = z.object({
	db_id: identity,
	hub: z.string(),
	last: sequence,
	max: sequence,
	due_policy: z.json().optional(),
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
	if (!parsed.success) throw new TypeError('Invalid Tracker push receipt');
	return parsed.data.db_id;
}

function decodeTrackerPullPage(reply: unknown, since: number) {
	const parsed = pullPage.safeParse(reply);
	if (!parsed.success) throw new TypeError('Invalid Tracker pull page');
	const page = parsed.data;
	let last = Math.min(since, page.max);
	for (const { seq } of page.ops) {
		if (seq <= since || seq <= last) throw new TypeError('Invalid Tracker pull page sequence');
		last = seq;
	}
	if (last > page.max || last !== page.last)
		throw new TypeError('Invalid Tracker pull page cursor');
	return page;
}
