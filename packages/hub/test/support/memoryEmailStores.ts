import type {
	EmailLedgerStore,
	EmailProofRecord,
	EmailProofStore,
	VerifiedEmailRecord
} from '../../src/models/HubAuthStore.types';

interface SendRow {
	day: number;
	count: number;
	lastSentAt: number;
}

function proofStore(rows: Map<string, EmailProofRecord>): EmailProofStore {
	return {
		async create(record) {
			rows.set(record.idHash, structuredClone(record));
		},
		async find(idHash) {
			return structuredClone(rows.get(idHash) ?? null);
		},
		async issue(issue) {
			const row = rows.get(issue.idHash);
			if (!row || row.claimed || row.expiresAt <= issue.now) return false;
			const expiresAt = Math.max(row.expiresAt, issue.codeExpiresAt);
			const { codeHash, codeExpiresAt } = issue;
			Object.assign(row, { codeHash, codeExpiresAt, attempts: 0, expiresAt });
			return true;
		},
		async attempt(attempt) {
			const row = rows.get(attempt.idHash);
			if (!row || row.claimed || row.codeHash === null || row.attempts >= attempt.limit)
				return null;
			if ((row.codeExpiresAt ?? 0) <= attempt.now || row.expiresAt <= attempt.now) return null;
			row.attempts += 1;
			row.claimed = row.codeHash === attempt.codeHash;
			return structuredClone(row);
		},
		async finish(idHash) {
			if (!rows.get(idHash)?.claimed) return false;
			return rows.delete(idHash);
		},
		async remove(idHash) {
			rows.delete(idHash);
		}
	};
}

function ledgerStore(
	sends: Map<string, SendRow>,
	verified: Map<string, VerifiedEmailRecord>
): EmailLedgerStore {
	return {
		async allow(window) {
			const row = sends.get(window.key);
			const sameDay = row?.day === window.day;
			const tooSoon = row !== undefined && row.lastSentAt > window.since;
			if (tooSoon || (sameDay && row.count >= window.cap)) return false;
			const count = sameDay ? row.count + 1 : 1;
			sends.set(window.key, { day: window.day, count, lastSentAt: window.now });
			return true;
		},
		async proven(actorId) {
			return structuredClone(verified.get(actorId) ?? null);
		},
		async prove(record) {
			verified.set(record.actorId, structuredClone(record));
		}
	};
}

/** The email-proof part of the in-memory test store, with the D1 adapter's semantics. */
export function memoryEmailStores() {
	const proofs = new Map<string, EmailProofRecord>();
	const sends = new Map<string, SendRow>();
	const verified = new Map<string, VerifiedEmailRecord>();
	return {
		emailProofs: proofStore(proofs),
		emailLedger: ledgerStore(sends, verified),
		rows: (): object[] => [...proofs.values(), ...sends.entries(), ...verified.values()],
		purge(now: number) {
			for (const [key, row] of proofs) if (row.expiresAt <= now) proofs.delete(key);
			for (const [key, row] of verified) if (row.expiresAt <= now) verified.delete(key);
			for (const [key, row] of sends) if (row.lastSentAt + 172_800_000 <= now) sends.delete(key);
		}
	};
}
