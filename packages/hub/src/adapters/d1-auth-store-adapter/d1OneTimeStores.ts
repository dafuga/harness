import { D1OneTimeStores } from '../../utils/d1OneTimeStores';
import type { D1Like } from './D1AuthStoreAdapter';
import type {
	ChallengeRecord,
	ExchangeStore,
	GithubStateRecord,
	OneTimeStore
} from '../../models/HubAuthStore.types.ts';
import type { AuthRecordValidator } from '../../validators/AuthRecordValidator';

/** DELETE ... RETURNING removes and returns in one statement, so only one caller gets the row. */
const CLAIM = 'WHERE id_hash = ? AND expires_at > ? RETURNING *';

const EXCHANGE_COLUMNS =
	'id, challenge, nonce_hash, code_hash, resource, audience, action, environment, origin, status, subject, parent_hash, expires_at';

function challenges(db: D1Like, records: AuthRecordValidator): OneTimeStore<ChallengeRecord> {
	return {
		async create(record) {
			const insert =
				'INSERT INTO auth_challenges (id_hash, nonce, csrf_hash, expires_at) VALUES (?, ?, ?, ?)';
			await db
				.prepare(insert)
				.bind(record.idHash, record.nonce, record.csrfHash, record.expiresAt)
				.run();
		},
		async claim(idHash, now) {
			const row = await db
				.prepare(`DELETE FROM auth_challenges ${CLAIM}`)
				.bind(idHash, now)
				.first();
			return row ? records.challenge(row) : null;
		}
	};
}

function githubStates(db: D1Like, records: AuthRecordValidator): OneTimeStore<GithubStateRecord> {
	return {
		async create(r) {
			const insert =
				'INSERT INTO auth_github_states (id_hash, session_hash, actor_id, grant_generation, verifier_cipher, expires_at) VALUES (?, ?, ?, ?, ?, ?)';
			const binding = [r.idHash, r.sessionHash, r.actorId, r.grantGeneration];
			await db
				.prepare(insert)
				.bind(...binding, r.verifierCipher, r.expiresAt)
				.run();
		},
		async claim(idHash, now) {
			const query = `DELETE FROM auth_github_states ${CLAIM}`;
			const row = await db.prepare(query).bind(idHash, now).first();
			return row ? records.githubState(row) : null;
		}
	};
}

function exchanges(db: D1Like, records: AuthRecordValidator): ExchangeStore {
	return {
		async create(r) {
			const insert = `INSERT INTO auth_native_exchanges (${EXCHANGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
			const scope = [r.resource, r.audience, r.action, r.environment, r.origin];
			await db
				.prepare(insert)
				.bind(
					r.id,
					r.challenge,
					r.nonceHash,
					r.codeHash,
					...scope,
					r.status,
					r.subject,
					r.parentHash,
					r.expiresAt
				)
				.run();
		},
		async find(id) {
			const row = await db
				.prepare('SELECT * FROM auth_native_exchanges WHERE id = ?')
				.bind(id)
				.first();
			return row ? records.exchange(row) : null;
		},
		async approve(a) {
			const update =
				"UPDATE auth_native_exchanges SET status = 'approved', subject = ?, parent_hash = ? WHERE id = ? AND status = 'pending' AND code_hash = ? AND expires_at > ? RETURNING id";
			const row = await db
				.prepare(update)
				.bind(a.subject, a.parentHash, a.id, a.codeHash, a.now)
				.first();
			return row !== null;
		},
		async claim(id, now) {
			const update =
				"UPDATE auth_native_exchanges SET status = 'consumed' WHERE id = ? AND status = 'approved' AND expires_at > ? RETURNING *";
			const row = await db.prepare(update).bind(id, now).first();
			return row ? records.exchange(row) : null;
		}
	};
}

export function d1OneTimeStores(db: D1Like, records: AuthRecordValidator): D1OneTimeStores {
	return {
		challenges: challenges(db, records),
		githubStates: githubStates(db, records),
		exchanges: exchanges(db, records)
	};
}
