import type {
	AuthStore,
	ChallengeRecord,
	ExchangeStore,
	GithubStateRecord,
	GrantLease,
	GrantState,
	GrantStore,
	NativeExchangeRecord,
	OneTimeStore,
	SessionRecord,
	SessionStore
} from '../../src/models/HubAuthStore.types';
import { memoryEmailStores } from './memoryEmailStores';

type Expiring = { expiresAt: number };
type Rows<T> = Map<string, T>;

function oneTime<T extends Expiring & { idHash: string }>(rows: Rows<T>): OneTimeStore<T> {
	return {
		async create(record) {
			rows.set(record.idHash, structuredClone(record));
		},
		async claim(idHash, now) {
			const record = rows.get(idHash);
			if (!record || record.expiresAt <= now) return null;
			rows.delete(idHash);
			return record;
		}
	};
}

function sessions(rows: Rows<SessionRecord>): SessionStore {
	return {
		async create(record) {
			rows.set(record.idHash, structuredClone(record));
		},
		async find(idHash) {
			return structuredClone(rows.get(idHash) ?? null);
		},
		async revoke(idHash, now) {
			for (const record of rows.values()) {
				const family = record.idHash === idHash || record.parentHash === idHash;
				if (family && record.revokedAt === null) record.revokedAt = now;
			}
		}
	};
}

function grants(rows: Rows<GrantState>): GrantStore {
	const generation = (actorId: string) => rows.get(actorId)?.generation ?? 0;
	const tombstone = (actorId: string) =>
		rows.set(actorId, { generation: generation(actorId) + 1, grant: null, refreshingUntil: null });
	const held = (lease: GrantLease) => {
		const row = rows.get(lease.actorId);
		const mine = row?.generation === lease.generation && row.refreshingUntil === lease.until;
		return row?.grant && mine ? row : null;
	};
	return {
		async read(actorId) {
			return structuredClone(
				rows.get(actorId) ?? { generation: 0, grant: null, refreshingUntil: null }
			);
		},
		async connect(expected, record) {
			if (generation(record.actorId) !== expected) return false;
			const grant = structuredClone(record);
			rows.set(record.actorId, { generation: expected + 1, grant, refreshingUntil: null });
			return true;
		},
		async lease(lease) {
			const row = rows.get(lease.actorId);
			const live =
				row?.grant && row.generation === lease.generation && row.grant.expiresAt > lease.now;
			if (!row || !live || (row.refreshingUntil ?? 0) > lease.now) return false;
			row.refreshingUntil = lease.until;
			return true;
		},
		async rotate(lease, record) {
			const row = held(lease);
			if (!row?.grant) return false;
			const { createdAt, expiresAt } = row.grant;
			Object.assign(row, { grant: { ...structuredClone(record), createdAt, expiresAt } });
			row.refreshingUntil = null;
			return true;
		},
		async revoke(actorId) {
			tombstone(actorId);
		},
		async revokeLeased(lease) {
			if (!held(lease)) return false;
			tombstone(lease.actorId);
			return true;
		}
	};
}

function exchanges(rows: Rows<NativeExchangeRecord>): ExchangeStore {
	const live = (id: string, now: number, status: string) => {
		const record = rows.get(id);
		return record && record.status === status && record.expiresAt > now ? record : null;
	};
	return {
		async create(record) {
			rows.set(record.id, structuredClone(record));
		},
		async find(id) {
			return structuredClone(rows.get(id) ?? null);
		},
		async approve(approval) {
			const record = live(approval.id, approval.now, 'pending');
			if (!record || record.codeHash !== approval.codeHash) return false;
			Object.assign(record, {
				status: 'approved',
				subject: approval.subject,
				parentHash: approval.parentHash
			});
			return true;
		},
		async claim(id, now) {
			const record = live(id, now, 'approved');
			if (!record) return null;
			record.status = 'consumed';
			return structuredClone(record);
		}
	};
}

function expire<T extends Expiring>(rows: Rows<T>, now: number, extra?: (row: T) => boolean) {
	for (const [key, row] of rows) if (row.expiresAt <= now || extra?.(row)) rows.delete(key);
}

export interface MemoryAuthStore extends AuthStore {
	/** Every stored row as text, for asserting that no secret is kept in the clear. */
	dump(): string;
	count(): number;
}

/** Test-only store with the same claim semantics as the D1 adapter (see the store contract). */
export function memoryAuthStore(): MemoryAuthStore {
	const tables = {
		challenges: new Map<string, ChallengeRecord>(),
		githubStates: new Map<string, GithubStateRecord>(),
		sessions: new Map<string, SessionRecord>(),
		grants: new Map<string, GrantState>(),
		exchanges: new Map<string, NativeExchangeRecord>()
	};
	const email = memoryEmailStores();
	const all = () => [
		...Object.values(tables).flatMap((rows) => [...rows.values()] as object[]),
		...email.rows()
	];
	const store: MemoryAuthStore = {
		challenges: oneTime(tables.challenges),
		githubStates: oneTime(tables.githubStates),
		sessions: sessions(tables.sessions),
		grants: grants(tables.grants),
		exchanges: exchanges(tables.exchanges),
		emailProofs: email.emailProofs,
		emailLedger: email.emailLedger,
		async purge(now) {
			expire(tables.challenges, now);
			expire(tables.githubStates, now);
			expire(tables.sessions, now, (row) => row.revokedAt !== null);
			for (const [actorId, row] of tables.grants) {
				if (row.grant && row.grant.expiresAt <= now) await store.grants.revoke(actorId, now);
			}
			expire(tables.exchanges, now);
			email.purge(now);
		},
		dump: () => JSON.stringify(all()),
		count: () => all().length
	};
	return store;
}
