import { D1CredentialStores } from '../../utils/d1CredentialStores';
import type { D1Like } from './D1AuthStoreAdapter';
import type { SessionStore } from '../../models/HubAuthStore.types.ts';
import type { AuthRecordValidator } from '../../validators/AuthRecordValidator';

const SESSION_COLUMNS =
	'id_hash, kind, parent_hash, actor_id, actor_email, actor_name, resource, created_at, expires_at, revoked_at';

function sessions(db: D1Like, records: AuthRecordValidator): SessionStore {
	return {
		async create(r) {
			const insert = `INSERT INTO auth_sessions (${SESSION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
			const actor = [r.actor.id, r.actor.email, r.actor.name];
			const times = [r.createdAt, r.expiresAt, r.revokedAt];
			await db
				.prepare(insert)
				.bind(r.idHash, r.kind, r.parentHash, ...actor, r.resource, ...times)
				.run();
		},
		async find(idHash) {
			const query = 'SELECT * FROM auth_sessions WHERE id_hash = ?';
			const row = await db.prepare(query).bind(idHash).first();
			return row ? records.session(row) : null;
		},
		async revoke(idHash, now) {
			const update =
				'UPDATE auth_sessions SET revoked_at = ? WHERE (id_hash = ? OR parent_hash = ?) AND revoked_at IS NULL';
			await db.prepare(update).bind(now, idHash, idHash).run();
		}
	};
}

export function d1CredentialStores(db: D1Like, records: AuthRecordValidator): D1CredentialStores {
	return { sessions: sessions(db, records) };
}
