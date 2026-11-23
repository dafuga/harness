// @harness-uid u_st4dufvqxm
import { randomUUID } from 'node:crypto';
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import { PhoneReplicaFeed } from './tracker-phone-replica-service/PhoneReplicaFeed';
import type { PhoneReplicaSnapshot } from './tracker-phone-replica-service/phoneReplicaPages.types';
import {
	deltaPage,
	expiredSnapshot,
	invalidCursor,
	snapshotPage
} from './tracker-phone-replica-service/phoneReplicaPages';

const snapshotLifetime = 15 * 60_000;
const maxPosition = 9_223_372_036_854_775_807n;
const phoneScope = /^[a-f0-9]{64}$/;

function positionString(value: unknown): value is string {
	return (
		typeof value === 'string' && /^(0|[1-9]\d{0,18})$/.test(value) && BigInt(value) <= maxPosition
	);
}

/** A bounded, projected read stream over a single native Tracker hub. */
export class TrackerPhoneReplicaService {
	private readonly snapshots = new Map<string, PhoneReplicaSnapshot>();
	private feed?: PhoneReplicaFeed;

	constructor(
		private readonly store: TrackerPersistenceService,
		private readonly now: () => number
	) {}

	pull(query: URLSearchParams): Response {
		const scope = query.get('scope') ?? '';
		const cursor = query.get('cursor');
		const continuation = query.get('continuation');
		const headers = { 'cache-control': 'private, no-store' };
		if (
			!phoneScope.test(scope) ||
			(cursor !== null && continuation !== null) ||
			!fits(cursor, 512) ||
			!fits(continuation, 48)
		)
			return Response.json({ kind: 'error', code: 'invalidRequest' }, { status: 400, headers });
		const now = this.now();
		return Response.json(this.page({ scope, cursor, continuation, now }), { headers });
	}

	private page(input: {
		scope: string;
		cursor: string | null;
		continuation: string | null;
		now: number;
	}) {
		const { scope, cursor, continuation, now } = input;
		this.expireSnapshots(now);
		if (continuation !== null) return this.continueSnapshot(scope, continuation);
		const feed = (this.feed ??= new PhoneReplicaFeed(this.store));
		const sequence = cursor === null ? null : this.position(scope, cursor);
		if (cursor !== null && sequence === null) return invalidCursor;
		feed.refresh(now);
		if (cursor === null || sequence === null) return this.snapshot(scope, feed, now);
		const since = BigInt(sequence);
		if (since < feed.floor() || since > BigInt(feed.head())) return invalidCursor;
		const { sequence: next, reply } = deltaPage(feed.after(sequence), { cursor, sequence, now });
		return { ...reply, cursor: this.cursor(scope, next) };
	}

	private snapshot(scope: string, feed: PhoneReplicaFeed, now: number) {
		const snapshot = {
			id: randomUUID(),
			startedAt: now,
			cursor: this.cursor(scope, feed.head()),
			rows: feed.current()
		};
		const first = snapshotPage(snapshot, 0);
		if (first.continuation !== null) {
			this.snapshots.delete(scope);
			const oldest = this.snapshots.keys().next().value;
			if (this.snapshots.size >= 4 && oldest !== undefined) this.snapshots.delete(oldest);
			this.snapshots.set(scope, snapshot);
		}
		return first;
	}

	private continueSnapshot(scope: string, continuation: string) {
		const match = /^([a-f0-9-]{36}):(\d{1,4})$/.exec(continuation);
		const snapshot = this.snapshots.get(scope);
		if (snapshot === undefined || match?.[1] !== snapshot.id) return expiredSnapshot;
		if (this.withdrawn(snapshot)) {
			this.snapshots.delete(scope);
			return expiredSnapshot;
		}
		const offset = Number(match[2]);
		return offset > 0 && offset < snapshot.rows.length
			? snapshotPage(snapshot, offset)
			: expiredSnapshot;
	}

	private withdrawn(snapshot: PhoneReplicaSnapshot): boolean {
		const stillVisible = this.store.database.prepare(
			'SELECT 1 FROM items WHERE id = ? AND deleted = 0 AND coalesce(sensitive, 0) = 0'
		);
		return snapshot.rows.some(({ id }) => !stillVisible.get(id));
	}

	private expireSnapshots(now: number): void {
		for (const [scope, snapshot] of this.snapshots) {
			if (now - snapshot.startedAt >= snapshotLifetime) this.snapshots.delete(scope);
		}
	}

	private cursor(scope: string, sequence: string) {
		const source = [this.store.dbId, this.feed?.epoch, scope, sequence];
		return Buffer.from(JSON.stringify(source)).toString('base64url');
	}

	private position(scope: string, cursor: string): string | null {
		try {
			const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
			if (!Array.isArray(decoded) || decoded.length !== 4) return null;
			const seq: unknown = decoded[3];
			return positionString(seq) && this.cursor(scope, seq) === cursor ? seq : null;
		} catch {
			return null;
		}
	}
}

function fits(value: string | null, max: number) {
	return value === null || (value.length > 0 && value.length <= max);
}
