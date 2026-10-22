import type { D1EmailStores } from '../../../../utils/networking-security/d1EmailStores';
import type { D1Like } from './D1AuthStoreAdapter';
import type {
	EmailLedgerStore,
	EmailProofStore
} from '../../../../models/accounts-access/HubAuthStore.types';
import type { AuthRecordValidator } from '../../../../validators/accounts-access/AuthRecordValidator';

const CREATE =
	'INSERT INTO auth_email_proofs (id_hash, actor_id, actor_email, actor_name, code_hash, code_expires_at, attempts, claimed, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

/** A new code replaces the old one and its spent attempts, and keeps the proof alive with it. */
const ISSUE =
	'UPDATE auth_email_proofs SET code_hash = ?, code_expires_at = ?, attempts = 0, expires_at = MAX(expires_at, ?) WHERE id_hash = ? AND claimed = 0 AND expires_at > ? RETURNING id_hash';

/**
 * One statement spends an attempt and decides the outcome, so parallel guesses cannot outrun the
 * limit and only one caller ever sees `claimed = 1`.
 */
const ATTEMPT =
	'UPDATE auth_email_proofs SET attempts = attempts + 1, claimed = CASE WHEN code_hash = ? THEN 1 ELSE 0 END WHERE id_hash = ? AND claimed = 0 AND code_hash IS NOT NULL AND attempts < ? AND code_expires_at > ? AND expires_at > ? RETURNING *';

const FINISH = 'DELETE FROM auth_email_proofs WHERE id_hash = ? AND claimed = 1 RETURNING id_hash';

/** One row per key. A new day restarts the count; a send inside the interval changes nothing. */
const ALLOW =
	'INSERT INTO auth_email_sends (send_key, send_day, send_count, last_sent_at) VALUES (?, ?, 1, ?) ON CONFLICT(send_key) DO UPDATE SET send_count = CASE WHEN auth_email_sends.send_day = excluded.send_day THEN auth_email_sends.send_count + 1 ELSE 1 END, send_day = excluded.send_day, last_sent_at = excluded.last_sent_at WHERE auth_email_sends.last_sent_at <= ? AND (auth_email_sends.send_day <> excluded.send_day OR auth_email_sends.send_count < ?) RETURNING send_count';

const PROVE =
	'INSERT OR REPLACE INTO auth_email_verified (actor_id, email_hash, verified_at, expires_at) VALUES (?, ?, ?, ?)';

function emailProofs(db: D1Like, records: AuthRecordValidator): EmailProofStore {
	const changed = async (query: string, values: unknown[]) =>
		(await db
			.prepare(query)
			.bind(...values)
			.first()) !== null;
	return {
		async create(r) {
			const actor = [r.actor.id, r.actor.email, r.actor.name];
			const code = [r.codeHash, r.codeExpiresAt, r.attempts, r.claimed ? 1 : 0];
			await db
				.prepare(CREATE)
				.bind(r.idHash, ...actor, ...code, r.expiresAt)
				.run();
		},
		async find(idHash) {
			const query = 'SELECT * FROM auth_email_proofs WHERE id_hash = ?';
			const row = await db.prepare(query).bind(idHash).first();
			return row ? records.emailProof(row) : null;
		},
		issue(i) {
			return changed(ISSUE, [i.codeHash, i.codeExpiresAt, i.codeExpiresAt, i.idHash, i.now]);
		},
		async attempt(a) {
			const values = [a.codeHash, a.idHash, a.limit, a.now, a.now];
			const row = await db
				.prepare(ATTEMPT)
				.bind(...values)
				.first();
			return row ? records.emailProof(row) : null;
		},
		finish(idHash) {
			return changed(FINISH, [idHash]);
		},
		async remove(idHash) {
			await db.prepare('DELETE FROM auth_email_proofs WHERE id_hash = ?').bind(idHash).run();
		}
	};
}

function emailLedger(db: D1Like, records: AuthRecordValidator): EmailLedgerStore {
	return {
		async allow(w) {
			const values = [w.key, w.day, w.now, w.since, w.cap];
			const row = await db
				.prepare(ALLOW)
				.bind(...values)
				.first();
			return row !== null;
		},
		async proven(actorId) {
			const query = 'SELECT * FROM auth_email_verified WHERE actor_id = ?';
			const row = await db.prepare(query).bind(actorId).first();
			return row ? records.verifiedEmail(row) : null;
		},
		async prove(r) {
			await db.prepare(PROVE).bind(r.actorId, r.emailHash, r.verifiedAt, r.expiresAt).run();
		}
	};
}

export function d1EmailStores(db: D1Like, records: AuthRecordValidator): D1EmailStores {
	return { emailProofs: emailProofs(db, records), emailLedger: emailLedger(db, records) };
}
